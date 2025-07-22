import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Chart, ChartConfiguration, ChartType, registerables, TooltipItem } from 'chart.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Register Chart.js components - THIS IS ESSENTIAL
Chart.register(...registerables);

// --- Interfaces ---
// Re-exporting from recommendations.interface for clarity if they are external files.
// Assuming these interfaces are correctly defined in '../../recommendations.interface'
import { Project, FullRecommendationDocument, SingleRecommendation, RecommendationSummary } from '../../recommendations.interface';

export interface Vulnerability {
  _id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  cve: string;
  packageName: string;
  installedVersion: string;
  fixedVersion: string;
  type: string;
  source: string;
}

export interface SecurityReport {
  success: boolean;
  count: number;
  results: Array<{
    _id: string;
    project: Project;
    tool: string;
    vulnerabilities: Vulnerability[];
  }>;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

interface RecommendationsApiGetResponse {
  success: boolean;
  count: number;
  overall_security_posture?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'N/A';
  total_vulnerabilities?: number;
  summary?: RecommendationSummary;
  recommendations: SingleRecommendation[];
  message?: string;
  projectId?: string;
  projectName?: string;
  scanDate?: string;
  gitlabProjectId?: number;
}


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('severityChart') severityChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourceChart') sourceChart!: ElementRef<HTMLCanvasElement>;

  private severityChartInstance: Chart | undefined;
  private sourceChartInstance: Chart | undefined;

  reportData: SecurityReport | null = null;
  vulnerabilities: Vulnerability[] = [];
  project: Project | null = null;
  loading = true;
  lastUpdated: Date | null = null;

  severityData: ChartData[] = [];
  sourceData: ChartData[] = [];

  totalVulnerabilities = 0;
  criticalCount = 0;
  uniquePackages = 0;
  overallSeverity: string = 'LOW'; // Default to 'LOW'

  displayRecommendations: SingleRecommendation[] = [];
  fullRecommendationDoc!: FullRecommendationDocument;

  private apiUrl = 'https://101e-197-27-238-33.ngrok-free.app/api/reports';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchSecurityData();
  }


  ngOnDestroy(): void {
    // Destroy chart instances to prevent memory leaks
    if (this.severityChartInstance) {
      this.severityChartInstance.destroy();
    }
    if (this.sourceChartInstance) {
      this.sourceChartInstance.destroy();
    }
  }

  fetchSecurityData(): void {
    this.loading = true;
    this.debugViewChild(); // Debugging ViewChild status before API call

    const headers = new HttpHeaders({
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json'
    });

    this.http.get<RecommendationsApiGetResponse>(`${this.apiUrl}/recommendations`, { headers }).pipe(
      tap(response => {
        console.log('Raw recommendations API response:', response);
      }),
      catchError(error => {
        console.error('Initial Recommendations API Error:', error);
        this.loading = false;
        this.reportData = null; // Ensure reportData is cleared on error
        this.displayRecommendations = [];
        this.project = null;
        this.processData(); // Process data even on error to clear dashboard metrics
        return throwError(() => new Error('Failed to fetch initial recommendations. Displaying no data.'));
      }),
      switchMap((recommendationsResponse) => {
        if (recommendationsResponse.success && recommendationsResponse.projectId) {
          // Construct the FullRecommendationDocument
          this.fullRecommendationDoc = {
            _id: 'unknown_recommendation_id', // Or generate a UUID
            project: {
              _id: recommendationsResponse.projectId,
              name: recommendationsResponse.projectName || 'Unknown Project',
              gitlabProjectId: recommendationsResponse.gitlabProjectId || 0
            },
            project_name: recommendationsResponse.projectName || 'Unknown Project',
            scan_date: recommendationsResponse.scanDate || new Date().toISOString(),
            overall_security_posture: recommendationsResponse.overall_security_posture || 'N/A',
            total_vulnerabilities: recommendationsResponse.total_vulnerabilities || 0,
            recommendations: recommendationsResponse.recommendations || [],
            summary: recommendationsResponse.summary || {
              critical_count: 0,
              high_count: 0,
              medium_count: 0,
              low_count: 0,
              total_recommendations: 0
            },
            error: recommendationsResponse.message,
          };

          this.displayRecommendations = this.fullRecommendationDoc.recommendations;
          this.project = this.fullRecommendationDoc.project;
          console.log(`Fetched recommendations and identified project: ${this.project.name} (${this.project._id})`);

          const projectIdForScanResults = recommendationsResponse.projectId;
          // Fetch scan results using the projectId obtained from recommendations
          return this.http.get<SecurityReport>(`${this.apiUrl}/scan-results?projectId=${projectIdForScanResults}`, { headers }).pipe(
            catchError(error => {
              console.error(`Scan Results API Error for project ${projectIdForScanResults}:`, error);
              this.reportData = null; // Clear scan results on error
              return of(null); // Return observable of null to allow the main subscription to complete
            })
          );
        } else {
          console.warn('No recommendations data found or projectId missing from recommendations response. Dashboard will show no data.');
          this.loading = false;
          this.reportData = null;
          this.displayRecommendations = [];
          this.project = null;
          this.processData(); // Process data to reset dashboard metrics
          return of(null); // Return observable of null if no project ID to fetch scan results
        }
      })
    ).subscribe({
      next: (scanResultsData: SecurityReport | null) => {
        if (scanResultsData) {
          this.reportData = scanResultsData;
          console.log('Successfully fetched scan results.');
        } else {
          console.warn('Scan results data is null or empty. Dashboard might show limited data.');
          this.reportData = null; // Explicitly set to null if no data
        }

        this.processData(); // Always process data, even if scanResultsData is null
        this.lastUpdated = new Date();
        this.loading = false;
        this.updateCharts(); // Update charts after data is processed
      },
      error: (error) => {
        console.error('Dashboard data fetching process failed:', error);
        this.loading = false;
        this.reportData = null; // Ensure data is cleared on overall process error
        this.processData(); // Process data to reset dashboard metrics
      },
      complete: () => {
        console.log('Dashboard data fetching process complete.');
      }
    });
  }

  private processSeverityData(): void {
    const severityCount = this.vulnerabilities.reduce((acc, vuln) => {
      const severityKey = (vuln.severity || 'UNKNOWN').toUpperCase();
      acc[severityKey] = (acc[severityKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.severityData = Object.entries(severityCount).map(([severity, count]) => ({
      name: severity,
      value: count,
      color: this.getSeverityColor(severity)
    }));
  }

  private processSourceData(): void {
    const sourceCount = this.vulnerabilities.reduce((acc, vuln) => {
      const sourceKey = (vuln.source || 'UNKNOWN');
      acc[sourceKey] = (acc[sourceKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.sourceData = Object.entries(sourceCount).map(([source, count]) => ({
      name: source,
      value: count,
      color: '#f97316' // Default color for source chart
    }));
  }


  createSourceChart(): void {
    console.log('Attempting to create source chart with data:', this.sourceData);

    // Ensure ViewChild is initialized and has a native element
    if (!this.sourceChart?.nativeElement) {
      console.warn('Source chart canvas element is not available. Chart cannot be created.');
      this.debugViewChild();
      return;
    }

    if (this.sourceData.length === 0) {
      console.warn('No source data available to create source chart.');
      // Optionally destroy existing chart if data becomes empty
      if (this.sourceChartInstance) {
        this.sourceChartInstance.destroy();
        this.sourceChartInstance = undefined;
      }
      return;
    }

    const ctx = this.sourceChart.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Cannot get 2D rendering context for source chart canvas.');
      return;
    }

    // Destroy existing chart instance before creating a new one
    if (this.sourceChartInstance) {
      this.sourceChartInstance.destroy();
    }

    const config: ChartConfiguration = {
      type: 'doughnut' as ChartType,
      data: {
        labels: this.sourceData.map(item => item.name),
        datasets: [{
          data: this.sourceData.map(item => item.value),
          backgroundColor: [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#A855F7', '#EC4899' // Added more colors
          ],
          borderColor: '#2d3748',
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverBorderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#ffffff',
            borderWidth: 1,
            callbacks: {
              label: (context: TooltipItem<'doughnut'>) => { // Use 'doughnut' type for tooltip
                const total = (context.dataset.data as number[]).reduce((sum: number, value: number) => sum + value, 0);
                const percentage = (((context.parsed as number) / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          duration: 1000
        }
      }
    };

    try {
      this.sourceChartInstance = new Chart(ctx, config);
      console.log('Source chart created successfully.');
    } catch (error) {
      console.error('Error creating source chart:', error);
    }
  }


ngAfterViewInit(): void {
  // Attendre que la vue soit complètement initialisée
  setTimeout(() => {
    console.log('ViewInit - Checking canvas elements...');
    this.debugViewChild();
    
    // Vérifier si les données sont disponibles
    if (this.severityData.length > 0 || this.sourceData.length > 0) {
      this.updateCharts();
    } else {
      console.log('No data available yet, charts will be created when data arrives');
    }
  }, 100); // Augmenter le délai pour s'assurer que le DOM est prêt
}

// Modifiez cette méthode pour améliorer la gestion des erreurs
createSeverityChart(): void {
  console.log('=== Creating Severity Chart ===');
  console.log('Severity data:', this.severityData);

  // Vérifications préliminaires
  if (!this.severityChart?.nativeElement) {
    console.error('Severity chart canvas element is not available');
    return;
  }

  if (this.severityData.length === 0) {
    console.warn('No severity data available');
    return;
  }

  const canvas = this.severityChart.nativeElement;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    console.error('Cannot get 2D context from canvas');
    return;
  }

  // Détruire le graphique existant
  if (this.severityChartInstance) {
    this.severityChartInstance.destroy();
    this.severityChartInstance = undefined;
  }

  // Configurer les dimensions du canvas
  canvas.width = 400;
  canvas.height = 400;

  const config: ChartConfiguration = {
    type: 'pie' as ChartType,
    data: {
      labels: this.severityData.map(item => item.name),
      datasets: [{
        data: this.severityData.map(item => item.value),
        backgroundColor: this.severityData.map(item => item.color || '#6b7280'),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Nous utilisons une légende personnalisée
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#ffffff',
          borderWidth: 1,
          callbacks: {
            label: (context: TooltipItem<'pie'>) => {
              const total = (context.dataset.data as number[]).reduce((sum: number, value: number) => sum + value, 0);
              const percentage = (((context.parsed as number) / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        duration: 1000,
        onComplete: () => {
          console.log('Severity chart animation completed');
        }
      }
    }
  };

  try {
    this.severityChartInstance = new Chart(ctx, config);
    console.log('Severity chart created successfully');
  } catch (error) {
    console.error('Error creating severity chart:', error);
  }
}

// Modifiez également la méthode updateCharts
updateCharts(): void {
  console.log('=== Updating Charts ===');
  console.log('Severity data length:', this.severityData.length);
  console.log('Source data length:', this.sourceData.length);
  
  // Attendre un peu pour s'assurer que le DOM est prêt
  setTimeout(() => {
    if (this.severityData.length > 0) {
      this.createSeverityChart();
    } else {
      console.log('No severity data to create chart');
    }
    
    if (this.sourceData.length > 0) {
      this.createSourceChart();
    } else {
      console.log('No source data to create chart');
    }
  }, 50);
}

// Ajoutez cette méthode pour forcer la recréation des graphiques
forceUpdateCharts(): void {
  console.log('=== Forcing Chart Update ===');
  
  // Détruire les graphiques existants
  if (this.severityChartInstance) {
    this.severityChartInstance.destroy();
    this.severityChartInstance = undefined;
  }
  
  if (this.sourceChartInstance) {
    this.sourceChartInstance.destroy();
    this.sourceChartInstance = undefined;
  }
  
  // Recréer les graphiques
  setTimeout(() => {
    this.updateCharts();
  }, 100);
}

// Modifiez la méthode processData pour appeler forceUpdateCharts
private processData(): void {
  if (!this.reportData || !this.reportData.results || this.reportData.results.length === 0) {
    console.warn('No security report data or results available. Resetting dashboard metrics.');
    this.vulnerabilities = [];
    this.totalVulnerabilities = 0;
    this.criticalCount = 0;
    this.uniquePackages = 0;
    this.overallSeverity = 'LOW';
    this.severityData = [];
    this.sourceData = [];
    this.project = null;
    return;
  }

  this.vulnerabilities = this.reportData.results.flatMap(result => result.vulnerabilities);

  // Préférer le projet de fullRecommendationDoc si disponible
  if (!this.project && this.reportData.results[0] && this.reportData.results[0].project) {
    this.project = this.reportData.results[0].project;
  } else if (this.project && this.reportData.results[0] && this.reportData.results[0].project && this.project._id !== this.reportData.results[0].project._id) {
    console.warn('Project ID mismatch between recommendations and scan results. Using project from scan results.');
    this.project = this.reportData.results[0].project;
  }

  this.totalVulnerabilities = this.vulnerabilities.length;
  this.criticalCount = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
  this.uniquePackages = new Set(this.vulnerabilities.map(v => v.packageName)).size;

  this.overallSeverity = this.vulnerabilities.some(v => v.severity === 'CRITICAL') ? 'CRITICAL' :
                        this.vulnerabilities.some(v => v.severity === 'HIGH') ? 'HIGH' :
                        this.vulnerabilities.some(v => v.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW';

  this.processSeverityData();
  this.processSourceData();
  
  // Forcer la mise à jour des graphiques après le traitement des données
  console.log('Data processed, forcing chart update...');
  this.forceUpdateCharts();
}

  // Debugging function for ViewChild elements
  debugViewChild(): void {
    console.log('=== ViewChild Debug Info ===');
    console.log('severityChart:', this.severityChart);
    console.log('severityChart element:', this.severityChart?.nativeElement);
    console.log('sourceChart:', this.sourceChart);
    console.log('sourceChart element:', this.sourceChart?.nativeElement);

    if (this.severityChart?.nativeElement) {
      const canvas = this.severityChart.nativeElement;
      console.log('Severity Canvas properties:', {
        tagName: canvas.tagName,
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        style: canvas.style.cssText
      });
    }
    if (this.sourceChart?.nativeElement) {
      const canvas = this.sourceChart.nativeElement;
      console.log('Source Canvas properties:', {
        tagName: canvas.tagName,
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        style: canvas.style.cssText
      });
    }
    console.log('Data available for charts:', {
      severityDataCount: this.severityData.length,
      sourceDataCount: this.sourceData.length
    });
    console.log('=== End Debug Info ===');
  }



showPDFLoading = false;

// Méthode pour ajouter un en-tête au PDF
private addPDFHeader(pdf: jsPDF): void {
  // Titre principal
  pdf.setFontSize(20);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Security Report', 105, 15, { align: 'center' });

  // Informations du projet
  pdf.setFontSize(12);
  pdf.text(`Project: ${this.project?.name || 'Unknown'}`, 15, 25);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, 32);
  pdf.text(`Total Vulnerabilities: ${this.totalVulnerabilities}`, 15, 39);
  pdf.text(`Overall Severity: ${this.overallSeverity}`, 15, 46);

  // Ligne de séparation
  pdf.setLineWidth(0.5);
  pdf.line(15, 50, 195, 50);
}

// Méthode alternative pour un PDF plus détaillé avec tableaux
async downloadDetailedPDFReport(): Promise<void> {
  try {
    this.showPDFLoading = true;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let yPosition = 20;

    // En-tête
    pdf.setFontSize(20);
    pdf.setTextColor(40, 40, 40);
    pdf.text('DevSecOps Security Report', 105, yPosition, { align: 'center' });
    yPosition += 15;

    // Informations du projet
    pdf.setFontSize(12);
    pdf.text(`Project: ${this.project?.name || 'Unknown'}`, 15, yPosition);
    yPosition += 7;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, yPosition);
    yPosition += 7;
    pdf.text(`Last Updated: ${this.lastUpdated?.toLocaleString() || 'N/A'}`, 15, yPosition);
    yPosition += 15;

    // Résumé des métriques
    pdf.setFontSize(16);
    pdf.text('Security Overview', 15, yPosition);
    yPosition += 10;

    pdf.setFontSize(12);
    const metrics = [
      `Total Vulnerabilities: ${this.totalVulnerabilities}`,
      `Critical Issues: ${this.criticalCount}`,
      `Outdated Packages: ${this.uniquePackages}`,
      `Overall Severity: ${this.overallSeverity}`
    ];

    metrics.forEach(metric => {
      pdf.text(metric, 15, yPosition);
      yPosition += 7;
    });

    yPosition += 10;

    // Distribution par sévérité
    pdf.setFontSize(16);
    pdf.text('Severity Distribution', 15, yPosition);
    yPosition += 10;

    pdf.setFontSize(12);
    this.severityData.forEach(item => {
      pdf.text(`${item.name}: ${item.value}`, 15, yPosition);
      yPosition += 7;
    });

    yPosition += 10;

    // Tableau des vulnérabilités (première page)
    pdf.setFontSize(16);
    pdf.text('Top Vulnerabilities', 15, yPosition);
    yPosition += 10;

    // Afficher les 10 premières vulnérabilités
    const topVulns = this.vulnerabilities.slice(0, 10);
    pdf.setFontSize(10);
    
    topVulns.forEach((vuln, index) => {
      if (yPosition > 270) { // Nouvelle page si nécessaire
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.text(`${index + 1}. ${vuln.cve} - ${vuln.packageName}`, 15, yPosition);
      yPosition += 5;
      pdf.text(`   Severity: ${vuln.severity} | Version: ${vuln.installedVersion}`, 15, yPosition);
      yPosition += 8;
    });

    // Recommandations
    if (this.displayRecommendations.length > 0) {
      pdf.addPage();
      yPosition = 20;
      
      pdf.setFontSize(16);
      pdf.text('Security Recommendations', 15, yPosition);
      yPosition += 15;

      this.displayRecommendations.slice(0, 5).forEach((rec, index) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFontSize(12);
        pdf.text(`${index + 1}. ${rec.summary}`, 15, yPosition);
        yPosition += 7;
        
        pdf.setFontSize(10);
        pdf.text(`Priority: ${rec.priority}`, 15, yPosition);
        yPosition += 5;
        
        // Description (tronquée si trop longue)
        const description = rec.description.length > 80 ? 
          rec.description.substring(0, 80) + '...' : rec.description;
        pdf.text(description, 15, yPosition);
        yPosition += 12;
      });
    }

    // Télécharger
    const projectName = this.project?.name || 'Unknown';
    const date = new Date().toISOString().split('T')[0];
    const fileName = `Security_Report_Detailed_${projectName}_${date}.pdf`;
    
    pdf.save(fileName);

  } catch (error) {
    console.error('Error generating detailed PDF report:', error);
  } finally {
    this.showPDFLoading = false;
  }
}



  getSeverityColor(severity: string): string {
    switch(severity.toUpperCase()) {
      case 'CRITICAL': return '#dc2626'; // Red-600
      case 'HIGH': return '#ea580c';     // Orange-600
      case 'MEDIUM': return '#f59e0b';   // Amber-500
      case 'LOW': return '#65a30d';      // Lime-700
      case 'UNKNOWN': return '#6b7280';  // Gray-500
      default: return '#6b7280';         // Gray-500
    }
  }

  getSeverityClass(severity: string): string {
    switch(severity.toUpperCase()) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return 'severity-default';
    }
  }

  getPriorityClass(priority: string): string {
    switch(priority) {
      case 'Immediate': return 'priority-immediate';
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return 'priority-default';
    }
  }

  refreshData(): void {
    this.fetchSecurityData();
  }

  openCVELink(cve: string): void {
    if (cve && cve !== 'N/A') {
      window.open(`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cve}`, '_blank');
    } else {
      console.warn('No valid CVE ID to open link.');
    }
  }
 
}