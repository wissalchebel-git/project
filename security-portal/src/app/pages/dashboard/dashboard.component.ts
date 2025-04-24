import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  chartOptions: any;
  isLoading: boolean = true;
  errorMessage: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadChartData();
  }

  // Fetch chart data from an API
  loadChartData() {
    this.http.get<any>('http://localhost:5000/api/reports')  
      .pipe(
        catchError(error => {
          this.isLoading = false;
          this.errorMessage = 'Failed to load data. Please try again later.';
          return of(null);
        })
      )
      .subscribe((data) => {
        if (data) {
          this.chartOptions = {
            title: { text: 'Security Issues Over Time' },
            xAxis: { type: 'category', data: data.weeks || ['Week 1', 'Week 2', 'Week 3', 'Week 4'] },
            yAxis: { type: 'value' },
            series: [
              { name: 'Critical', type: 'bar', data: data.critical || [10, 15, 9, 5], color: 'red' },
              { name: 'High', type: 'bar', data: data.high || [20, 18, 22, 15], color: 'orange' }
            ]
          };
        }
        this.isLoading = false;
      });
  }
}
