import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NbThemeModule, NbLayoutModule, NbSidebarModule, NbMenuModule, NbActionsModule, NbCardModule, NbListModule, NbToggleModule, NbAlertModule, NbUserModule, 
  NbButtonModule, NbSelectModule, NbOptionModule, NbRadioModule, NbCheckboxModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { NgxEchartsModule } from 'ngx-echarts';
import { EvaluationComponent } from './pages/evaluation/evaluation.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { ProfileComponent } from './pages/profile/profile.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    ReportsComponent,
    SettingsComponent,
    EvaluationComponent,
    NotificationsComponent,
    ProfileComponent
  ],
  imports: [
    FormsModule,
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    NbThemeModule.forRoot({ name: 'default' }),
    NbLayoutModule,
    NbSidebarModule.forRoot(),
    NbMenuModule.forRoot(),
    NbActionsModule,
    NbCardModule,
    NbListModule,
    NbEvaIconsModule,
    NbToggleModule,
    NbAlertModule,
    NbUserModule,
    NbButtonModule,
    NbSelectModule,
    NbOptionModule,
    NbRadioModule,
    NbCheckboxModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts'),
    }),
  ],
  providers: [NbSidebarModule],
  bootstrap: [AppComponent]
})
export class AppModule { }
