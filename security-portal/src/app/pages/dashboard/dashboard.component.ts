import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // For loading spinner
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; // For recommendation dialog

import { ScanReportService, ScanResult, Project, Recommendation } from '../../services/scan-report.service';
import { Subject, takeUntil } from 'rxjs';

// Create a dialog component for recommendations
@Component({
  selector: 'app-recommendations-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Recommendations for Scan Result</h2>
    <mat-dialog-content>
      <div *ngIf="recommendations.length > 0">
        <mat-card *ngFor="let rec of recommendations" class="recommendation-card">
          <mat-card-header>
            <mat-card-title>{{ rec.title }}</mat-card-title>
            <mat-card-subtitle>Severity: <span [class]="'severity-' + rec.severity">{{ rec.severity | titlecase }}</span> | Status: {{ rec.status | titlecase }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p>{{ rec.description }}</p>
            <p *ngIf="rec.toolSuggested">Tool Suggested: {{ rec.toolSuggested }}</p>
          </mat-card-content>
        </mat-card>
      </div>
      <div *ngIf="recommendations.length === 0">
        <p>No specific recommendations found for this scan result.</p>
      </div>
      <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .recommendation-card { margin-bottom: 10px; }
    .severity-low { color: green; font-weight: bold; }
    .severity-medium { color: orange; font-weight: bold; }
    .severity-high { color: red; font-weight: bold; }
    .error-message { color: #d32f2f; background-color: #ffcdd2; padding: 10px; border-radius: 4px; margin-top: 10px;}
  `]
})
export class RecommendationsDialog {
  recommendations: Recommendation[] = [];
  errorMessage: string | null = null;
  constructor(
    public dialogRef: MatDialog, // Inject MatDialog
    private scanReportService: ScanReportService // Inject service to fetch recommendations
  ) {}

  // This method will be called when the dialog is opened
  // You can pass data to the dialog via MatDialog's `data` option
  // For simplicity, we'll fetch them here using an input property or by modifying constructor
  // For a real app, inject MAT_DIALOG_DATA and pass scanResultId
  // For now, let's assume we pass scanResultId from the parent
  loadRecommendations(scanResultId: string) {
    this.scanReportService.getRecommendationsForScan(scanResultId).subscribe({
      next: (response) => {
        if (response.success) {
          this.recommendations = response.recommendations;
        } else {
          this.errorMessage = response.message || response.error || 'Failed to load recommendations.';
        }
      },
      error: (err) => {
        console.error('Error loading recommendations:', err);
        this.errorMessage = 'An error occurred while fetching recommendations.';
      }
    });
  }
}


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCardModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule, // Add this
    MatDialogModule // Add this
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['createdAt', 'project', 'tool', 'severity', 'score', 'vulnerabilitiesCount', 'reportUrl', 'actions'];
  dataSource = new MatTableDataSource<ScanResult>();
  isLoading = true;
  errorMessage: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

  constructor(
    private scanReportService: ScanReportService,
    public dialog: MatDialog // Inject MatDialog
  ) { }

  ngOnInit(): void {
    this.fetchScanResults();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchScanResults(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.scanReportService.getAllScanResults()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dataSource.data = response.results.map(result => ({
              ...result,
              // Check if 'project' is an object (populated) or just a string ID
              projectName: (result.project && typeof result.project === 'object' && 'name' in result.project)
                           ? (result.project as Project).name
                           : (result.project || 'N/A'), // Fallback to ID or N/A
              vulnerabilitiesCount: result.vulnerabilities ? result.vulnerabilities.length : 0,
              createdAt: new Date(result.createdAt).toLocaleString()
            }));
            this.isLoading = false;
          } else {
            this.errorMessage = response.error || 'Failed to fetch scan results.';
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error('Error fetching scan results:', err);
          this.errorMessage = 'Could not load scan results. Please check the API connection and backend logs.';
          this.isLoading = false;
        }
      });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  viewReport(url: string | undefined): void {
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('No report URL available for this entry.');
    }
  }

  viewRecommendations(scanResultId: string): void {
    const dialogRef = this.dialog.open(RecommendationsDialog, {
      width: '600px', // Adjust width as needed
      data: { scanResultId: scanResultId } // Pass data to dialog
    });

    // Manually trigger data load in dialog component
    dialogRef.componentInstance.loadRecommendations(scanResultId);
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'Critical': return 'red';
      case 'High': return 'orange';
      case 'Medium': return 'yellowgreen'; // Changed to differentiate better
      case 'Low': return 'green';
      case 'None': return 'gray';
      default: return 'black';
    }
  }
}
