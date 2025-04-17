import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  chartOptions: any;  

  ngOnInit(): void {
    this.chartOptions = {
      title: { text: 'Security Issues Over Time' },
      xAxis: { type: 'category', data: ['Week 1', 'Week 2', 'Week 3', 'Week 4'] },
      yAxis: { type: 'value' },
      series: [
        { name: 'Critical', type: 'bar', data: [10, 15, 9, 5], color: 'red' },
        { name: 'High', type: 'bar', data: [20, 18, 22, 15], color: 'orange' }
      ]
    };
  }
}
