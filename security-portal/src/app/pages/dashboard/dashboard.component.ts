import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs'; // Import throwError for better error handling
import { catchError, switchMap, tap } from 'rxjs/operators'; // Import switchMap and tap

// Correct path to your interfaces
import { Project, FullRecommendationDocument, SingleRecommendation ,RecommendationSummary ,AffectedVulnerability } from '../../recommendations.interface';

// Your existing interfaces for scan results and charts (no changes needed here)
export interface Vulnerability {
  _id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'; // Added UNKNOWN for robustness
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

// Define the expected response structure from the /api/reports/recommendations endpoint
// This matches what your backend's getAllRecommendations sends
interface RecommendationsApiGetResponse {
  success: boolean;
  count: number;
  overall_security_posture?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'N/A';
  total_vulnerabilities?: number;
  summary?: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    total_recommendations: number;
  };
  recommendations: SingleRecommendation[]; // This is the array of detailed recommendations
  message?: string;
  projectId?: string; // The MongoDB _id of the project
  projectName?: string; // The name of the project
  scanDate?: string; // The date of the latest scan for this project
  gitlabProjectId?: number; // GitLab's native numeric ID for the project
}
interface RecommendationsApiGetResponse {
  success: boolean;
  count: number;
  overall_security_posture?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'N/A';
  total_vulnerabilities?: number;
  summary?: RecommendationSummary; // Ensure RecommendationSummary is imported or defined
  recommendations: SingleRecommendation[]; // Ensure SingleRecommendation is imported or defined
  message?: string;
  projectId?: string; // Present in API response
  projectName?: string; // Present in API response
  scanDate?: string; // Present in API response (camelCase)
  // gitlabProjectId is missing in your current RecommendationsApiGetResponse, but used in component logic.
  // Make sure your backend sends it if you want it here, or add it as optional
  gitlabProjectId?: number; // Add this if your API response includes it
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  reportData: SecurityReport | null = null;
  vulnerabilities: Vulnerability[] = [];
  project: Project | null = null; // This will hold the details of the latest project
  loading = true;
  lastUpdated: Date | null = null;

  severityData: ChartData[] = [];
  sourceData: ChartData[] = [];

  totalVulnerabilities = 0;
  criticalCount = 0;
  uniquePackages = 0;
  overallSeverity: string = 'LOW';

  displayRecommendations: SingleRecommendation[] = [];
  fullRecommendationDoc!: FullRecommendationDocument;

  // Centralize your API base URL for better management
  private apiUrl = 'https://101e-197-27-238-33.ngrok-free.app/api/reports'; // Adjust if your base URL changes

  constructor(private http: HttpClient, ) {}

  ngOnInit(): void {
    this.fetchSecurityData();
  }

   fetchSecurityData(): void {
    this.loading = true;

    const headers = new HttpHeaders({
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json'
    });

    // Use the specific API response type here
    this.http.get<RecommendationsApiGetResponse>(`${this.apiUrl}/recommendations`, { headers }).pipe(
      tap(response => {
        console.log('Raw recommendations API response:', response);
      }),
      catchError(error => {
        console.error('Initial Recommendations API Error:', error);
        this.loading = false;
        return throwError(() => new Error('Failed to fetch initial recommendations. Displaying no data.'));
      }),
      // The type for recommendationsResponse is now correctly inferred as RecommendationsApiGetResponse
      switchMap((recommendationsResponse) => {
        if (recommendationsResponse.success && recommendationsResponse.projectId) {

          // *** CRITICAL FIX HERE: CONSTRUCT THE FullRecommendationDocument ***
          this.fullRecommendationDoc = {
            // _id is NOT returned by your current getAllRecommendations API at the top level,
            // so if FullRecommendationDocument requires it, you'd need to modify your backend.
            // For now, if you've made it optional in recommendations.interface.ts, you can omit it or assign a placeholder.
            _id: 'unknown_recommendation_id', // Placeholder, or make _id optional in FullRecommendationDocument
            project: { // Construct the 'project' object expected by FullRecommendationDocument
              _id: recommendationsResponse.projectId,
              name: recommendationsResponse.projectName || 'Unknown Project',
              gitlabProjectId: recommendationsResponse.gitlabProjectId || 0 // Use gitlabProjectId from response
            },
            project_name: recommendationsResponse.projectName || 'Unknown Project',
            scan_date: recommendationsResponse.scanDate || new Date().toISOString(), // Map camelCase scanDate to snake_case scan_date
            overall_security_posture: recommendationsResponse.overall_security_posture || 'N/A',
            total_vulnerabilities: recommendationsResponse.total_vulnerabilities || 0,
            recommendations: recommendationsResponse.recommendations || [],
            summary: recommendationsResponse.summary || { critical_count: 0, high_count: 0, medium_count: 0, low_count: 0, total_recommendations: 0 },
            error: recommendationsResponse.message, // Map message to error if needed
            // createdAt, updatedAt, __v are also not returned by your current API in this response.
            // If FullRecommendationDocument requires them, you must either modify the backend
            // or make them optional in the FullRecommendationDocument interface.
          };

          this.displayRecommendations = this.fullRecommendationDoc.recommendations; // Now correctly assigned from the constructed doc

          // Set the top-level project property for the dashboard's display
          this.project = this.fullRecommendationDoc.project;
          console.log(`Fetched recommendations and identified project: ${this.project.name} (${this.project._id})`);

          // ... (rest of your switchMap logic for fetching scan results)
          const projectIdForScanResults = recommendationsResponse.projectId;
          return this.http.get<SecurityReport>(`${this.apiUrl}/scan-results?projectId=${projectIdForScanResults}`, { headers }).pipe(
            catchError(error => {
              console.error(`Scan Results API Error for project ${projectIdForScanResults}:`, error);
              this.reportData = null;
              this.processData();
              return of(null);
            })
          );
        } else {
          // ... (existing logic for no recommendations or missing projectId)
          console.warn('No recommendations data found or projectId missing. Dashboard will show no data.');
          this.loading = false;
          this.reportData = null;
          this.displayRecommendations = [];
          this.project = null;
          this.processData();
          return of(null);
        }
      })
    ).subscribe({
      next: (scanResultsData: SecurityReport | null) => {
        // This 'next' callback receives the result of the scanResults$ observable (the second call in the chain)
        if (scanResultsData) {
          this.reportData = scanResultsData;
          this.processData(); // Process `reportData` for metrics and charts
        } else {
          // If scanResultsData is null (due to error in the second call), samples were already loaded.
          console.warn('Scan results data is null. Sample data should be loaded.');
        }

        this.lastUpdated = new Date();
        this.loading = false;
      },
      error: (error) => {
        // This 'error' callback will catch errors propagated by throwError() from the initial recommendations fetch
        console.error('Dashboard data fetching process failed:', error);
        this.loading = false;
        // Sample data for both should already be loaded by the catchError/else branch in the switchMap
      },
      complete: () => {
        console.log('Dashboard data fetching complete.');
      }
    });
  }

  // Adjusted loadSampleData functions to be more robust
  private loadSampleScanData(): void {
    console.log('Loading sample scan results data.');
    this.reportData = {
      success: true,
      count: 1,
      results: [{
        _id: "sample_scan_id_1",
        project: {
          _id: "sample_project_id_1",
          name: "Sample Project Alpha",
          gitlabProjectId: 12345
        },
        tool: "Automated Scan",
        vulnerabilities: [
          { _id: "v1", name: "Sample Critical Bug", description: "...", severity: "CRITICAL", cve: "CVE-SAMPLE-001", packageName: "app-core", installedVersion: "1.0.0", fixedVersion: "1.0.1", type: "code", source: "Sonarqube" },
          { _id: "v2", name: "Sample High Risk Dependency", description: "...", severity: "HIGH", cve: "CVE-SAMPLE-002", packageName: "node-lib", installedVersion: "2.1.0", fixedVersion: "2.1.1", type: "dependency", source: "Trivy" },
          { _id: "v3", name: "Sample Medium Configuration Issue", description: "...", severity: "MEDIUM", cve: "N/A", packageName: "config-file", installedVersion: "N/A", fixedVersion: "N/A", type: "configuration", source: "Manual Review" }
        ]
      }]
    };
    // Ensure the project context for the dashboard is also set from sample data
    this.project = this.reportData.results[0].project;
    this.processData(); // Process the loaded sample scan data to update charts/metrics
  }

  private loadSampleRecommendationsData(): void {
    console.log('Loading sample recommendations data.');
    this.displayRecommendations = [
      {
        id: 'rec_sample_1',
        type: 'Security Patch',
        severity_level: 'Critical',
        priority: 'Immediate',
        summary: 'Address Critical Vulnerabilities Immediately',
        description: 'Several critical vulnerabilities were identified in core components. Prompt patching is required.',
        action_items: ["Apply patches for all critical vulnerabilities.", "Verify fixes in staging environment."],
        affected_vulnerabilities: [{ name: "Sample Critical Vulnerability", severity: "CRITICAL", source: "Snyk", cve: "CVE-SAMPLE-CRIT", description: "...", package_name: "sample-lib", installed_version: "1.0.0", fixed_version: "1.0.1" }]
      },
      {
        id: 'rec_sample_2',
        type: 'Code Refactoring',
        severity_level: 'High',
        priority: 'High',
        summary: 'Refactor Insecure Code Patterns',
        description: 'Code analysis identified several high-risk insecure coding practices.',
        action_items: ["Review identified insecure code patterns.", "Implement secure coding guidelines.", "Conduct peer code reviews for security."],
        affected_vulnerabilities: [{ name: "Insecure Deserialization", severity: "HIGH", source: "Sonarqube", cve: "N/A", description: "..." }]
      }
    ];
    // Create a mock FullRecommendationDocument consistent with the API response
    this.fullRecommendationDoc = {
      _id: "sample_recommendation_doc_id",
      project: {
          _id: "sample_project_id_1",
          name: "Sample Project Alpha",
          gitlabProjectId: 12345
        }, // Link to sample project ID
      project_name: "Sample Project Alpha",
      scan_date: new Date().toISOString(),
      overall_security_posture: "HIGH",
      total_vulnerabilities: 2, // Corresponds to total recommendations in sample
      summary: { critical_count: 1, high_count: 1, medium_count: 0, low_count: 0, total_recommendations: 2 },
      recommendations: this.displayRecommendations
    };
  }

  private processData(): void {
    if (!this.reportData || !this.reportData.results || this.reportData.results.length === 0) {
      this.vulnerabilities = [];
      this.project = null; // Ensure project is null if no scan data
      this.totalVulnerabilities = 0;
      this.criticalCount = 0;
      this.uniquePackages = 0;
      this.overallSeverity = 'LOW';
      this.severityData = [];
      this.sourceData = [];
      return;
    }

    // Since we're fetching scan results for a specific project now,
    // this.reportData.results should ideally contain only results for that project.
    this.vulnerabilities = this.reportData.results.flatMap(result => result.vulnerabilities);

    // Ensure the project object is consistently set from the scan results if available,
    // otherwise it should already be set from the recommendations call.
    if (this.reportData.results[0] && this.reportData.results[0].project) {
        this.project = this.reportData.results[0].project;
    }

    this.totalVulnerabilities = this.vulnerabilities.length;
    this.criticalCount = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    this.uniquePackages = new Set(this.vulnerabilities.map(v => v.packageName)).size;

    // Determine overall severity based on processed vulnerabilities
    this.overallSeverity = this.vulnerabilities.some(v => v.severity === 'CRITICAL') ? 'CRITICAL' :
                          this.vulnerabilities.some(v => v.severity === 'HIGH') ? 'HIGH' :
                          this.vulnerabilities.some(v => v.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW';

    this.processSeverityData();
    this.processSourceData();
  }

  private processSeverityData(): void {
    const severityCount = this.vulnerabilities.reduce((acc, vuln) => {
      const severityKey = (vuln.severity || 'UNKNOWN').toUpperCase(); // Ensure uppercase and handle unknown
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
      color: '#f97316' // You might want more distinct colors here
    }));
  }

  getSeverityColor(severity: string): string {
    switch(severity.toUpperCase()) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#65a30d';
      default: return '#6b7280'; // Default for UNKNOWN or other
    }
  }

  getSeverityClass(severity: string): string {
    switch(severity.toUpperCase()) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return 'severity-default'; // Default for UNKNOWN or other
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