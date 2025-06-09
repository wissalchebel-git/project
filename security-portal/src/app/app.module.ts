import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NbSpinnerModule, NbThemeModule, NbLayoutModule, NbSidebarModule, NbMenuModule, NbActionsModule, NbCardModule, NbListModule, NbToggleModule, NbAlertModule, NbUserModule, 
  NbButtonModule, NbSelectModule, NbOptionModule, NbRadioModule, NbCheckboxModule, 
  NbTooltipModule, NbProgressBarModule, NbBadgeModule, } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbIconModule } from '@nebular/theme';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { NgxEchartsModule } from 'ngx-echarts';
import { EvaluationComponent } from './pages/evaluation/evaluation.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { ReactiveFormsModule } from '@angular/forms';
import { JwtHelperService, JWT_OPTIONS } from '@auth0/angular-jwt';
// Services
import { AuthService } from './auth.service';

// Guards
import { AuthGuard } from './auth.guard';
import { AuthComponent } from './auth/auth.component';


@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    ReportsComponent,
    SettingsComponent,
    EvaluationComponent,
    NotificationsComponent,
    ProfileComponent,
    HeaderComponent,
    FooterComponent,
    LoginComponent,
    SignupComponent,
    AuthComponent,
  ],
  imports: [
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    NbThemeModule.forRoot({ name: 'default' }),
    NbLayoutModule,
    NbSidebarModule.forRoot(),
    NbMenuModule.forRoot(),
    NbActionsModule,
    NbSpinnerModule,
    NbCardModule,
    NbListModule,
    NbEvaIconsModule,
    NbIconModule ,
    NbTooltipModule,
    NbToggleModule,
    NbAlertModule,
    NbUserModule,
    NbButtonModule,
    NbSelectModule,
    NbOptionModule,
    NbRadioModule,
    NbCheckboxModule,
    NbProgressBarModule,
    NbBadgeModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts'),
    }),
  ],

  providers: [NbSidebarModule, AuthService, AuthGuard,     
    { provide: JWT_OPTIONS, useValue: JWT_OPTIONS },
    JwtHelperService],
  bootstrap: [AppComponent]
})
export class AppModule { }
