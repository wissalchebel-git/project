import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interface for the Project details when populated
export interface Project {
  _id: string;
  name: string;
  gitlabProjectId: number;
  // Add other project fields if needed
}

// Define an interface for your ScanResult model to ensure type safety
export interface ScanResult {
  _id: string;
  project: string | Project; // Can be ObjectId string or populated Project object
  tool: 'SonarQube' | 'Trivy' | 'OWASP ZAP' | 'GitLab CI Initiator' | 'OWASP Dependency Check' | 'Automated Scan' | 'Rapport Agrégé';
  // issues?: string[]; // Removed as per model, add back if needed
  vulnerabilities?: Vulnerability[];
  score?: number;
  severity: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  reportUrl?: string;
  gitlabPipelineId?: number;
  gitlabJobId?: number;
  createdAt: string;
  // Add sonarqubeReportUrl if you plan to use it specifically
  sonarqubeReportUrl?: string;
}

export interface Vulnerability {
  name: string;
  description: string;
  severity: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  cve?: string;
  ruleId?: string;
  type?: string; // e.g., 'BUG', 'VULNERABILITY', 'CODE_SMELL', 'N/A'
  component?: string;
  line?: number;
  packageName?: string;
  installedVersion?: string;
  fixedVersion?: string;
  source?: string; // Add this from your backend model
  sourceUrl?: string;
}

export interface ScanResultsResponse {
  success: boolean;
  count: number;
  results: ScanResult[];
  error?: string; // Add error field for consistency
}

export interface SingleScanResultResponse {
  success: boolean;
  result: ScanResult;
  error?: string;
}

export interface Recommendation {
  _id: string;
  project: string | Project;
  relatedScan?: string;
  title: string;
  description?: string;
  toolSuggested?: 'Trivy' | 'OWASP' | 'SonarQube' | 'GitLab SAST' | 'Other';
  severity?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'accepted' | 'dismissed' | 'implemented';
  createdAt: string;
}

export interface RecommendationsResponse {
  success: boolean;
  recommendations: Recommendation[];
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScanReportService {
  private backendUrl = 'http://localhost:5000/api/reports'; // IMPORTANT: Use your actual backend URL here

  constructor(private http: HttpClient) { }

  getAllScanResults(): Observable<ScanResultsResponse> {
    // You can add query parameters like projectId here later:
    // return this.http.get<ScanResultsResponse>(`${this.backendUrl}/scan-results?projectId=${projectId}`);
    return this.http.get<ScanResultsResponse>(`${this.backendUrl}/scan-results`);
  }

  getScanResultById(id: string): Observable<SingleScanResultResponse> {
    return this.http.get<SingleScanResultResponse>(`${this.backendUrl}/scan-results/${id}`);
  }

  getRecommendationsForScan(scanResultId: string): Observable<RecommendationsResponse> {
    return this.http.get<RecommendationsResponse>(`${this.backendUrl}/scan-results/${scanResultId}/recommendations`);
  }
}
