import { Component } from '@angular/core';
import { NbThemeService } from '@nebular/theme';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  email = 'johndoe@example.com';
  password = '';
  role = 'admin';
  darkMode = false;
  twoFactorAuth = false;

  constructor(private themeService: NbThemeService) {}

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    this.themeService.changeTheme(this.darkMode ? 'dark' : 'default');
  }

  saveProfile(): void {
    alert('Profile saved successfully!');
  }

  logout(): void {
    alert('Logging out...');
    
  }
}
