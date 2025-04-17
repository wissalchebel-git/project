import { Component } from '@angular/core';
import { NbSidebarService } from '@nebular/theme';

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
  
  constructor(private sidebarService: NbSidebarService) {}

  toggleSidebar(): void {
    this.sidebarService.toggle(false, 'menu-sidebar');
    
  }
}
