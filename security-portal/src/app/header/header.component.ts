import { Component } from '@angular/core';
import { UserService } from '../../user.service';
import {NbSidebarService} from '@nebular/theme';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  userPictureOnly: boolean = false;
  user: any;
  
  userMenu = [
    { title: 'Profile', link: '/pages/profile' },
    { title: 'Settings', link: '/pages/profile/settings' },
    { title: 'Log out', link: '/auth/logout' }
  ];

  constructor(
     private sidebarService: NbSidebarService,
    private userService: UserService
  ) {
    this.userService.getCurrentUser().subscribe(user => {
      this.user = user;
    });
  }

   toggleSidebar() {
    this.sidebarService.toggle(true, 'menu-sidebar');
   }
  
   onMenuClick(item: any): void {
    if (item.action === 'logout') 
      AuthService.logout();
    
  }
}
