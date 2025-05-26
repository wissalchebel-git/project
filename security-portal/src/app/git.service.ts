import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GitService {
  private baseUrl = 'http://localhost:5000/api/git';

  constructor(private http: HttpClient) {}

  cloneRepo(repoUrl: string): Observable<any> {
    return this.http.post(`${this.baseUrl}`, { repoUrl });
  }

  createGitLabProjectAndPush(repoUrl: string, token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/gitlab-push`, { repoUrl, token });
  }

  saveScanResult(result: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/scan-results`, result);
  }
}
