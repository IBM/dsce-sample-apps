import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, NgZone, AfterViewChecked, Input, OnChanges } from '@angular/core';
import { Output, EventEmitter } from '@angular/core';
import { GroupedBarChart, SimpleBarChart } from '@carbon/charts';

@Component({
	selector: 'metrics',
	templateUrl: './metrics.component.html',
	styleUrls: ['./metrics.component.scss']
})
export class MetricsComponent implements OnInit, AfterViewInit, AfterViewChecked, OnChanges {

	rougeChartOptions: any;
	bleuChartOptions: any;
	perplexityChartOptions: any;
	llmAsJudgeResult: any;
	showEvaluations: boolean = false;

	MARKER_COLOR: any = {"GREEN": "LightSeaGreen", "ORANGE": "RoyalBlue"};
	costConfig: any = {
		perDayAPICalls: 1000
	}

	@Input() loaders: any;
	// @Input() evaluationMetrics: any;
	@Input() referenceText: any;

	@Output() updateParentEvent = new EventEmitter<any>();
	@Output() showContent = new EventEmitter<any>();

	@ViewChild('rougeChart') private rougeChart : GroupedBarChart;
	@ViewChild('bleuChart') private bleuChart : SimpleBarChart;
	@ViewChild('perplexityChart') private perplexityChart : SimpleBarChart;

	constructor() {	 }

	async ngOnInit(): Promise<void> {
		console.log("IN EvaluationComponent init: >> ");
	}

	ngAfterViewInit() {
		// console.log("IN EvaluationComponent ngAfterViewInit: >> ");
	}

	ngAfterViewChecked() {

    }

	async ngOnChanges(){
		// await this.updateChart();
	}

	async reset(){
		if(this.rougeChartOptions && this.rougeChartOptions["data"] && this.rougeChartOptions["data"].length > 0){
			this.rougeChartOptions["data"] = [];
		}
		if(this.bleuChartOptions && this.bleuChartOptions["data"] && this.bleuChartOptions["data"].length > 0){
			this.bleuChartOptions["data"] = [];
		}
		if(this.perplexityChartOptions && this.perplexityChartOptions["data"] && this.perplexityChartOptions["data"].length > 0){
			this.perplexityChartOptions["data"] = [];
		}

		this.showEvaluations = false;
	}

	async updateChart(evaluationResult){
		console.log("IN updateChart for ", evaluationResult)
		if(evaluationResult){
			await this.updateEvaluationChart(evaluationResult)
		}

		this.loaders['metrics']['rouge'] = false;
		this.loaders['metrics']['bleu'] = false;
		this.loaders['metrics']['perplexity'] = false;
	}

	private async updateEvaluationChart(evaluationResult){
		console.log("IN updateEvaluationChart,updateChart >> evaluationResult:  ", evaluationResult);
		if(evaluationResult){
			if(evaluationResult["metrics"] && evaluationResult["metrics"].hasOwnProperty("rouge")){
				this.loaders['metrics']['rouge'] = false;
				this.showRougeChart(evaluationResult["metrics"]["rouge"], evaluationResult["model_id"]).then(()=> {});
				this.showEvaluations = true;
			}

			if(evaluationResult["metrics"] && evaluationResult["metrics"].hasOwnProperty("bleu")){
				this.loaders['metrics']['bleu'] = false;
				this.showBleuChart(evaluationResult["metrics"]["bleu"], evaluationResult["model_id"]).then(()=> {});
				this.showEvaluations = true;
			}

			if(evaluationResult["metrics"] && evaluationResult["metrics"].hasOwnProperty("perplexity")){
				this.loaders['metrics']['perplexity'] = false;
				this.showPerplexityChart(evaluationResult["metrics"]["perplexity"], evaluationResult["model_id"]).then(()=> {});
				this.showEvaluations = true;
			}

			if(evaluationResult["metrics"] && evaluationResult["metrics"].hasOwnProperty("llm_as_judge")){
				this.loaders['metrics']['llm_as_judge'] = false;
				this.showLLMAsJudgeChart(evaluationResult["metrics"]["llm_as_judge"], evaluationResult["model_id"]);
				this.showEvaluations = true;
			}

		}
	}

	private roundOff(num){
		return Math.round((num + Number.EPSILON) * 100) / 100
	}

	private async showRougeChart(metric: any, model_id: string){
		console.log("IN showRougeChart: ", model_id, metric);
		if(metric){
			const data_point = [
				{
					group: model_id,
					key: "rouge1",
					value: this.roundOff(metric["rouge1"]["score"])
				},
				{
					group: model_id,
					key: "rouge2",
					value: this.roundOff(metric["rouge2"]["score"])
				},
				{
					group: model_id,
					key: "rougeL",
					value: this.roundOff(metric["rougeL"]["score"])
				}
				// {
				// 	group: model_id,
				// 	key: "rougeLsum",
				// 	value: this.roundOff(metric["rougeLsum"]["score"])
				// }
			];

			if(this.rougeChartOptions && this.rougeChartOptions["data"] && this.rougeChartOptions["data"].length > 0){
				data_point.forEach(element => {
					this.rougeChartOptions["data"].push(element);
				});
				// console.log("Data in RougeChart: ", this.rougeChartOptions["data"]);
				if(this.rougeChart){
					this.rougeChart.model.setData(this.rougeChartOptions["data"])
				}
			}else{
				this.rougeChartOptions = {
					"data": data_point,
					"options": {
						title: 'Rouge Score',
						axes: {
							left: {
								title: 'Rouge Score',
								mapsTo: 'value'
							},
							bottom: {
								title: 'Rouge Evaluation Metrics',
								scaleType : "labels",
								mapsTo: 'key'
							}
						},
						legend: {
							position: 'bottom',
							alignment: 'center'
						},
						height: '400px'
					}
				}
			}
		}

	}

	private async showBleuChart(metric: any, model_id: string){
		console.log("IN showBleuChart: ", model_id, metric);
		if(metric){

			const bias = 1

			const data_point = [
				{
					group: model_id,
					key: "bleu1",
					value: this.roundOff(metric["bleu1"]["score"] * bias)
				},
				{
					group: model_id,
					key: "bleu2",
					value: this.roundOff(metric["bleu2"]["score"] * bias)
				},
				{
					group: model_id,
					key: "bleu3",
					value: this.roundOff(metric["bleu3"]["score"] * bias)
				},
				{
					group: model_id,
					key: "bleu4",
					value: this.roundOff(metric["bleu4"]["score"] * bias)
				}
			];

			if(this.bleuChartOptions && this.bleuChartOptions["data"] && this.bleuChartOptions["data"].length > 0){
				data_point.forEach(element => {
					this.bleuChartOptions["data"].push(element);
				});
				// console.log("Data in BleuChart: ", this.bleuChartOptions["data"]);
				if(this.bleuChart){
					this.bleuChart.model.setData(this.bleuChartOptions["data"])
				}
			}else{
				this.bleuChartOptions = {
					"data": data_point,
					"options": {
						title: 'Bleu Score',
						axes: {
							left: {
								title: 'Bleu Score',
								mapsTo: 'value'
							},
							bottom: {
								title: 'Bleu Evaluation Metrics',
								scaleType : "labels",
								mapsTo: 'key'
							}
						},
						legend: {
							position: 'bottom',
							alignment: 'center'
						},
						height: '400px'
					}
				}
			}
		}

	}

	private async showPerplexityChart(metric: any, model_id: string){
		console.log("IN showPerplexityChart: ", model_id, metric);
		if(metric){
			let score = metric;
			if("mean_perplexity" in metric){
				score = metric["mean_perplexity"];
			}
			const data_point = [
				{
					group: model_id,
					value: this.roundOff(score)
				}
			];

			if(this.perplexityChartOptions && this.perplexityChartOptions["data"] && this.perplexityChartOptions["data"].length > 0){
				data_point.forEach(element => {
					this.perplexityChartOptions["data"].push(element);
				});
				// console.log("Data in PerplexityChart: ", this.perplexityChartOptions["data"]);
				if(this.perplexityChart){
					this.perplexityChart.model.setData(this.perplexityChartOptions["data"])
				}
			}else{
				this.perplexityChartOptions = {
					"data": data_point,
					"options": {
						title: 'Perplexity Score',
						axes: {
							left: {
								title: 'Perplexity Score',
								mapsTo: 'value'
							},
							bottom: {
								title: 'Perplexity Evaluation Metrics',
								scaleType : "labels",
								mapsTo: 'group'
							}
						},
						legend: {
							position: 'bottom',
							alignment: 'center'
						},
						height: '400px'
					}
				}
			}
		}

	}

	private showLLMAsJudgeChart(metric: any, model_id: string){
		console.log("IN showLLMAsJudgeChart, model_id: ", model_id, ", metric: ", metric);
		if(this.llmAsJudgeResult && this.llmAsJudgeResult.length > 0){
			this.llmAsJudgeResult.push({"model_id": model_id, "metric": metric})
		}else{
			this.llmAsJudgeResult = [{"model_id": model_id, "metric": metric}]
		}
	}

	// private async showPerplexityChart(metric: any, model_id: string){
	// 	let data_point = {};
	// 	if(metric){
	// 		console.log("IN showPerplexityChart, evaluations, model_id: >> ", model_id, ", metric: ", metric);
	// 		data_point = {y: this.roundOff(metric), label: model_id, color: this.MARKER_COLOR.GREEN};
	// 	}

	// 	if(this.perplexityChartOptions){
	// 		data_point["color"] = this.MARKER_COLOR.ORANGE;
	// 		this.perplexityChartOptions["data"][0]["dataPoints"].push(data_point);
	// 		this.perplexityChart.render();
	// 	}else{
	// 		this.perplexityChartOptions = {
	// 				theme: "light2",
	// 				animationEnabled: true,
	// 				legend: {
	// 					horizontalAlign: "right",
	// 					verticalAlign: "center",
	// 					reversed: true
	// 				},
	// 				axisY: {
	// 					title: "Perplexity Score",
	// 					includeZero: true,
    //   					suffix: "%"
	// 				},
	// 				data: [
	// 						{
	// 							type: "column",
	// 							// showInLegend: true,
	// 							// indexLabel: "{y}",
	// 							dataPoints: [data_point]
	// 						}
	// 				]
	// 		}
	// 	}
	// }

}
