import { Component, OnInit } from '@angular/core';

interface SettingOption {
  label: string;
  description: string;
  status: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'basic';
  enabled: boolean;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  settings: SettingOption[] = [
    {
      label: 'Enable Security Scans',
      description: 'Automatically run security scans on new commits and merges.',
      status: 'success',
      enabled: true
    },
    {
      label: 'Enable Email Notifications',
      description: 'Receive alerts when vulnerabilities or issues are detected.',
      status: 'warning',
      enabled: false
    },
    {
      label: 'Enable Dark Mode',
      description: 'Switch to a dark theme for reduced eye strain and better focus.',
      status: 'info',
      enabled: false
    },
    {
      label: 'Enable Auto Updates',
      description: 'Keep tools and dependencies up-to-date automatically.',
      status: 'primary',
      enabled: true
    },
    {
      label: 'Enable Real-time Alerts',
      description: 'Get instant alerts for critical threats or scan failures.',
      status: 'danger',
      enabled: true
    },
    {
      label: 'Enable Developer Mode',
      description: 'Activate advanced logs and debugging tools for developers.',
      status: 'basic',
      enabled: false
    }
  ];

  ngOnInit(): void {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      this.settings = JSON.parse(savedSettings);
    }
  }

  saveSettings(): void {
    localStorage.setItem('userSettings', JSON.stringify(this.settings));
    alert('Settings saved successfully!');
  }
}
