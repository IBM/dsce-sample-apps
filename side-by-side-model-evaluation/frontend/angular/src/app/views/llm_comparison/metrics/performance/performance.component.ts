import { Component, OnInit, AfterViewInit, AfterViewChecked, Input, OnChanges } from '@angular/core';
import { Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'performance',
	templateUrl: './performance.component.html',
	styleUrls: ['./performance.component.scss']
})
export class PerformanceComponent implements OnInit, AfterViewInit, AfterViewChecked, OnChanges {

	chart: any;
	performanceChart: any;

	MARKER_COLOR: any = {"GREEN": "LightSeaGreen", "ORANGE": "RoyalBlue"};
	// costConfig: any = {
	// 	perDayAPICalls: 1000
	// }

	@Input() parentData: any;

	@Input() llm1Response: any;
	@Input() selectedLLM1: any;
	@Input() llm2Response: any;
	@Input() selectedLLM2: any;
	@Input() costConfig: any;

	@Output() updateParentEvent = new EventEmitter<any>();
	@Output() showContent = new EventEmitter<any>();

	constructor() {	 }

	async ngOnInit(): Promise<void> {
		console.log("IN PerformanceComponent init: >> ");
	}

	ngAfterViewInit() {
		console.log("IN PerformanceComponent ngAfterViewInit: >> ");
	}

	ngAfterViewChecked() {

    }

	ngOnChanges(){
		this.updateChart();
	}

	getPerformanceChartInstance(chart: object){
		// console.log("IN getPerformanceChartInstance: ", chart);
		this.chart = chart;
	}

	async updateChart(){
		if(!this.costConfig || !('perDayAPICalls' in this.costConfig)){
			this.costConfig = {
				"perDayAPICalls": 1000
			}
		}
		console.log("IN PerformanceComponent.updateChart, costConfig: ", this.costConfig);
		// this.performaceChartOptions = null;
		this.performanceChart = null;
		if(this.llm1Response && this.llm1Response["output"]["stop_reason"] && this.llm1Response["output"]["stop_reason"] != "not_finished" && this.selectedLLM1){
			this.updatePerformanceChart(this.llm1Response, this.selectedLLM1)
		}

		if(this.llm2Response && this.llm2Response["output"]["stop_reason"] && this.llm2Response["output"]["stop_reason"] != "not_finished" && this.selectedLLM2){
			this.updatePerformanceChart(this.llm2Response, this.selectedLLM2)
		}
	}

	private updatePerformanceChart(llmResponse, llmSpec){
		console.log("IN updatePerformanceChart,updateChart >> llmResponse:  ", this.llm1Response["output"]);
		let cost = {"model_id": llmSpec['id']};
		if("total_cost" in llmResponse['output']){
			console.log("IN calculateLLMCost, total_cost: >>", llmResponse['output']["total_cost"]);
			// llmResponse["single_api_cost"] = llmResponse['output']["total_cost"]
		}

		let input_token_count = llmResponse['output']['input_token_count'];
		const generated_token_count = llmResponse['output']['generated_token_count'];
		const single_api_cost = ((llmSpec["price_input"] * input_token_count) / 1000000)  + ((llmSpec["price_output"] * generated_token_count) / 1000000) ;
		cost["single_api_cost"] = single_api_cost

		cost['per_day_cost'] = cost['single_api_cost'] * this.costConfig['perDayAPICalls'];
		cost['per_month_cost'] = cost['per_day_cost'] * 30;
		cost['per_annum_cost'] = cost['per_day_cost'] * 365

		cost["price_input"] = llmSpec["price_input"]
		cost["price_output"] = llmSpec["price_output"]
		console.log("IN calculateLLMCost, single_api_cost: >>", cost["single_api_cost"]);
		llmResponse['cost'] = cost;
		// await this.showPerformanceNCostChart(cost, llmResponse['time_taken']);
		this.updatePerformanceNCostChart(cost, llmResponse['time_taken']).then(()=> {});

		return cost;
	}

	private async updatePerformanceNCostChart(cost: any, time_taken: number){
		const data_point = {
			group: cost['model_id'],
			per_annum_cost: this.roundOff(cost['per_annum_cost']),
			time_taken: this.roundOff(time_taken),
			name: cost['model_id']
		};

		if(this.performanceChart && this.performanceChart["data"] && this.performanceChart["data"].length > 0){
			this.performanceChart["data"].push(data_point);
		}else{
			this.performanceChart = {
				"data": [data_point],
				"options": {
					title: 'Performance Chart',
					tooltip: {
						customHTML: ((data, defaultHTML) => {
							// return "LLM: " + data['group']+ "\nAnnual cost: "+data['per_annum_cost'] + "\n"
							// console.log(data)
							// console.log(defaultHTML)
							return defaultHTML;
						}),
						groupLabel: "LLM",
						valueFormatter: ((value, label) => {
							if(label == 'Time Taken'){
								return String(value) + 's'
							}
							if(label == 'Annual cost ($)'){
								return "$" +String(value)
							}
							return value
						})
					},
					axes: {
						bottom: {
							title: 'Time Taken',
							mapsTo: 'time_taken',
							includeZero: false,
							ticks: {
								formatter: ((tick, i) => {
									return String(tick) + "s"
								})
							}
						},
						left: {
							title: 'Annual cost ($)',
							mapsTo: 'per_annum_cost',
							includeZero: false,
							ticks: {
								formatter: ((tick, i) => {
									return "$" + String(tick)
								})
							}
						}
					},
					bubble: {
						radiusMapsTo: 'per_annum_cost',
						// radiusLabel: 'Per Annum Cost'
					},
					legend: {
						additionalItems: [
						{
							type: 'radius',
							name: 'Per Annum Cost'
						}
						],
						position: 'bottom',
						alignment: 'center'
					},
					height: '400px'
				  }
			}
		}
	}

	private roundOff(num){
		return Math.round((num + Number.EPSILON) * 100) / 100
	}

}
