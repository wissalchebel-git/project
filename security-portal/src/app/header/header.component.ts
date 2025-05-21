import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  currentUser: any;
  
  constructor(
    private authService: AuthService,  // Inject the AuthService as an instance
    private router: Router
  ) { }

  ngOnInit(): void {
    // Subscribe to the current user observable
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
  }

  logout(): void {
    // Call logout as an instance method
    this.authService.logout();
    // The router navigation is already handled in the AuthService
  }
}