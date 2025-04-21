import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GitService {
  private baseUrl = 'http://localhost:5000/api/git';

  constructor(private http: HttpClient) {}

  cloneRepo(repoUrl: string) {
    return this.http.post(this.baseUrl, { repoUrl });
  }
}
