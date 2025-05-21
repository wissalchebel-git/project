import { Component } from '@angular/core';
import { NbSidebarService } from '@nebular/theme';
import { Router } from '@angular/router';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']  
})
export class AppComponent {
  title = 'security-portal';
  
 

  menuItems = [  
    { title: 'Dashboard', icon: 'home-outline', link: '/dashboard' },
    { title: 'Evaluation', icon: 'edit-2-outline', link: '/evaluation' },
    { title: 'Security Reports', icon: 'file-text-outline', link: '/reports' },
    { title: 'Notifications', icon: 'bell-outline', link: '/notifications' },
    { title: 'User Profile', icon: 'person-outline', link: '/profile' },
    { title: 'Settings', icon: 'settings-outline', link: '/settings' }
  ];
  
constructor(
  private router: Router,
  private sidebarService: NbSidebarService
) {}

  get isLoginPage(): boolean {
    return this.router.url === '/login';
  }

  toggleSidebar(): void {
    this.sidebarService.toggle(true, 'menu-sidebar');
  }

  get hideLayout(): boolean {
    console.log('Router URL in AppComponent:', this.router.url);
  const hiddenRoutes = ['/login', '/signup'];
  return hiddenRoutes.includes(this.router.url);
}

}

