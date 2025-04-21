import { Component } from '@angular/core';

@Component({
  selector: 'app-evaluation',
  templateUrl: './evaluation.component.html',
  styleUrls: ['./evaluation.component.scss']
})
export class EvaluationComponent {
  answers: any = {
    projectName: '',
    gitlabRepo: '',
    repoURL: '',
    projectObjective: '',
    involvedParties: '',
    email: '',
    mfa: '',
    repoProtection: '',
    securityMeasures: [],
    securityTools: '',
    staticDynamicTools: '',
    automatedTests: '',
    ciCdSecurity: '',
    dependencyManagement: '',
    scaTools: '',
    vulnerabilityScans: '',
    identifiedVulnerabilities: '',
    vulnerabilityHandling: '',
    updateFrequency: '',
    monitoringTools: '',
    secretsManagement: '',
    contingencyPlan: '',
    contingencyDetails: '',
    securityStandards: '',
    riskAssessment: '',
    securityTraining: '',
    trainingFrequency: '',
    userAwareness: ''
  };

  score: number = 0;

  calculateScore() {
    this.score = 0; // Reset score before calculation

    // Basic security practices (Yes = 10 points)
    if (this.answers.mfa === 'yes') this.score += 10;
    if (this.answers.repoProtection === 'yes') this.score += 10;
    if (this.answers.securityMeasures.includes('access_control')) this.score += 5;
    if (this.answers.securityMeasures.includes('data_encryption')) this.score += 5;
    if (this.answers.securityMeasures.includes('regular_audits')) this.score += 5;
    if (this.answers.securityTools) this.score += 10;
    if (this.answers.staticDynamicTools) this.score += 10;
    if (this.answers.automatedTests === 'yes') this.score += 10;
    if (this.answers.ciCdSecurity) this.score += 10;
    if (this.answers.dependencyManagement) this.score += 5;
    if (this.answers.scaTools) this.score += 10;
    if (this.answers.vulnerabilityScans === 'yes') this.score += 10;
    if (this.answers.identifiedVulnerabilities === 'yes') this.score += 5;
    if (this.answers.updateFrequency) this.score += 5;
    if (this.answers.monitoringTools === 'yes') this.score += 10;
    if (this.answers.secretsManagement === 'yes') this.score += 10;
    if (this.answers.contingencyPlan === 'yes') this.score += 10;
    if (this.answers.securityStandards) this.score += 10;
    if (this.answers.riskAssessment === 'yes') this.score += 10;
    if (this.answers.securityTraining === 'yes') this.score += 5;
    if (this.answers.userAwareness) this.score += 5;

    // Normalize score out of 100
    this.score = Math.min(100, this.score);

    alert(`Security Score: ${this.score}/100`);
  }

  cloneGithubRepo() {
    if (!this.answers.githubURL) {
      alert("Please provide a valid GitHub repository URL.");
      return;
    }
  
    // You can later integrate actual cloning via backend service
    console.log("Cloning repository from:", this.answers.githubURL);
    
    // Optionally trigger a backend API:
    // this.http.post('/api/clone', { url: this.answers.githubURL }).subscribe(...)
  }
  
}
