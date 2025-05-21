import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../auth.service';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  returnUrl!: string;
  error = '';

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {
    // Redirect to dashboard if already logged in
    if (this.authService.currentUserValue) {
      this.router.navigate(['/pages/dashboard']);
    }
  }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Get return url from route parameters or default to dashboard
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/pages/dashboard';
  }

  // Convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;

    // Stop if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    // Use the actual login method for production
    this.authService.login(this.f['email'].value, this.f['password'].value)
      .subscribe({
        next: () => {
          // Login successful, redirect to return url
          this.router.navigate([this.returnUrl]);
        },
        error: (error) => {
          this.error = error.error?.message || 'Login failed. Please try again.';
          this.loading = false;
        }
      });
      
    /* Comment this block out or remove it when switching to the real login
    //this.authService.mockLogin(this.f['email'].value, this.f['password'].value)
       //.subscribe({
         next: () => {
           // Login successful, redirect to return url
           this.router.navigate([this.returnUrl]);
         },
        error: (error) => {
          this.error = error.error?.message || 'Login failed. Please try again.';
          this.loading = false;
        }
      });*/
  }
}