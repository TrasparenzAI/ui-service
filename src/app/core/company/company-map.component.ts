import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Observable, debounceTime } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiMessageService, MessageType } from '../api-message.service';
import { DatePipe, formatNumber } from '@angular/common';
import { CompanyService } from './company.service';
import { ResultAggregatorService } from '../result-aggregator/result-aggregator.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Rule, SelectRule } from '../rule/rule.model';
import { environment } from '../../../environments/environment';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { RuleService } from '../rule/rule.service';
import { TranslateService } from '@ngx-translate/core';
import { DurationFormatPipe } from '../../shared/pipes/durationFormat.pipe';
import { ConfigurationService } from '../configuration/configuration.service';
import * as Leaflet from 'leaflet';
import 'leaflet.markercluster';

@Component({
    selector: 'company-map',
    templateUrl: './company-map.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, DurationFormatPipe],
    styles: `
    .marker-cluster-small, .marker-cluster-small div{
      background-color: lightblue
    }
    .marker-cluster-medium, .marker-cluster-medium div{
      background-color: blue;
      color: white
    }
    .marker-cluster-large, .marker-cluster-large div {
      background-color: violet
    }
  `,
    standalone: false
})
export class CompanyMapComponent implements OnInit {
  protected static ZOOM: number = 18;
  protected isGEOLoaded: boolean = false;  
  protected options: Leaflet.MapOptions
  protected center;
  protected zoom;
  protected workflowId;
  protected ruleName;
  protected cache = true;

  protected filter: boolean = false;
  
  protected currentMarker: Leaflet.Marker;
  protected map: Leaflet.Map;
  
  protected filterFormSearch: FormGroup;
  protected optionsWorkflow: Array<any> = [];
  protected optionsRule: Array<any>;
  protected excludedCodiciIpa = new Set<string>();

  constructor(
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef,
    private translateService: TranslateService,
    private companyService: CompanyService,
    private ruleService: RuleService,
    private route: ActivatedRoute,
    private apiMessageService: ApiMessageService,
    private resultAggregatorService: ResultAggregatorService,
    private conductorService: ConductorService,
    private configurationService: ConfigurationService,
    private datepipe: DatePipe,
    private durationFormatPipe: DurationFormatPipe,
    private router: Router) {
  }

  markerClusterData: Leaflet.Marker[] = [];
  markerClusterOptions: Leaflet.MarkerClusterGroupOptions = {
    iconCreateFunction: function(cluster) {
      var childCount = cluster.getChildCount();
      var c = ' marker-cluster-';
      if (childCount < 10) {
        c += 'small';
      } else if (childCount < 100) {
        c += 'medium';
      } else {
        c += 'large';
      }
      var markers = cluster.getAllChildMarkers();
      var markersOK = 0, statusPresent = false;
      markers.forEach((element: any) => {
        let status = element?.options?.status;
        if (status) {
          if (status == 200 || status == 202) {
            markersOK++;
          }
          statusPresent = true;
        }
      });
      if (statusPresent) {
          var percentOK = Math.floor((markersOK * 100)/childCount), percentFail = 100 - percentOK,            
            style = percentOK > 50 ? `color:white; background-image: conic-gradient(green ${percentOK}%, red ${percentFail}%);` :
                `color:white; background-image: conic-gradient(red ${percentFail}%, green ${percentOK}%)`;
            return new Leaflet.DivIcon({ 
              html: `<div style="${style}"><span>${percentOK}%</span></div>`, 
              className: `marker-cluster`, 
              iconSize: new Leaflet.Point(40, 40) 
            });      
      } else {
        return new Leaflet.DivIcon({ 
          html: `<div><span>${childCount}</span></div>`, 
          className: `marker-cluster${c}`, 
          iconSize: new Leaflet.Point(40, 40) 
        });  
      }
    }
  };

  onMapReady(map: Leaflet.Map): void {
    this.map = map;
  }
  
  markerClusterReady(markerCluster: Leaflet.MarkerClusterGroup) {
    if (this.currentMarker) {
      const parent = this.currentMarker['__parent'];
      if (parent && parent._zoom == CompanyMapComponent.ZOOM){
        parent.spiderfy();      
      }
      this.currentMarker.fire('click');
      this.currentMarker.openPopup();
    }
    if (this.workflowId) {
      markerCluster.on('clustermouseover', function ($event) {
        var cluster = $event?.sourceTarget,
          childCount = formatNumber(cluster.getChildCount(), 'it-IT');
        $event.propagatedFrom.bindTooltip(`
            <span class="position-absolute top-0 start-100 translate-middle badge bg-primary fs-6 fw-lighter">${childCount} <strong>PA</strong></span>
        `, {sticky: false}).openTooltip();
      });  
    }
  }

  public getGeoJson(): Observable<any> {
    if (this.workflowId && this.ruleName) {
      let params = new HttpParams()
        .set(`workflowId`, this.workflowId)
        .set(`ruleName`, this.ruleName);
      return this.resultAggregatorService.getAny(`/v1/aggregator/geojson${this.filterFormSearch?.value?.cache ? `/gzip`: `/nocache`}`, params);
    } else {
      return this.companyService.getAny(`/v1/geo/geojson`);
    } 
  }

  private initMap(workflowId: string, queryParams: any) {
    this.filterFormSearch = this.formBuilder.group({
      workflowId: new FormControl(workflowId),
      ruleName: new FormControl(this.ruleName),
      preserveZoom: new FormControl(true),
      cache: new FormControl(this.cache)
    });
    this.filterFormSearch.valueChanges.pipe(
      debounceTime(500)
    ).subscribe((valueChanges: any) => {
      if (this.workflowId != valueChanges.workflowId ||
          this.ruleName != valueChanges.ruleName ||
          this.cache != valueChanges.cache) {
        this.workflowId = valueChanges.workflowId;
        this.ruleName = valueChanges.ruleName;
        this.cache = valueChanges.cache;
        if (!valueChanges.preserveZoom) {
          this.center = new Leaflet.LatLng(42.00, 11.50);
          this.zoom = queryParams.zoom || 6;
        }        
        this.loadRules(this.workflowId);
        this.loadGeoJson(queryParams);
      }
    });
    this.workflowId = workflowId;    
    this.conductorService.getAll({
      includeClosed: true,
      includeTasks: false
    }).subscribe((workflows: Workflow[]) => {
      workflows.forEach((workflow: Workflow) => {
        if (workflow.isCompleted) {
          this.optionsWorkflow.push({
            value: workflow.workflowId,
            text: this.translateService.instant('it.workflow.textfull', {
              startTime: this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy'),
              duration: this.durationFormatPipe.transform(workflow.executionTime)
            }),
            selected: workflow.workflowId === workflow.workflowId,
            ruleName: workflow.input.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE
          });
        }
      });
      this.loadRules(this.workflowId);
    });
    this.loadGeoJson(queryParams);
  }

  loadRules(workflowId: string) {
    this.ruleService.getRules().subscribe((resultRules: Map<String, Rule>) => {
      this.optionsRule = [];
      let rule = resultRules.get(this.workflowRuleName(workflowId));
      let rules: SelectRule[] = rule.getKeys(undefined, undefined, Rule.AMMINISTRAZIONE_TRASPARENTE, [], -1);
      Object.keys(rules).forEach((index) => {
        this.optionsRule.push({
          value: rules[index].key,
          text: rules[index].text,
          level: rules[index].level,
          class: `ps-${rules[index].level} fs-${rules[index].level + 3}`
        });
      });
    });
  }

  ngAfterContentChecked(): void {
    this.cdr.detectChanges();
  }

  ngOnInit(): void {    
    this.center = new Leaflet.LatLng(41.00, 12.50);
    this.configurationService.getCompanyCardDisplay().subscribe((display) => {
      this.excludedCodiciIpa = new Set((display?.excludedCodiciIpa || []).map((codiceIpa: string) => (codiceIpa || '').trim().toUpperCase()));
      this.route.queryParams.subscribe((queryParams) => {
        this.filter = queryParams.filter;
        this.zoom = queryParams.zoom || 6;
        this.workflowId = queryParams.workflowId;
        this.ruleName = queryParams.ruleName || this.workflowRuleName(this.workflowId);
        if (!this.filter) {
          this.loadGeoJson(queryParams);
        } else {
          if (queryParams.workflowId) {
            this.initMap(queryParams.workflowId, queryParams);
          } else {
            this.conductorService.lastWorflowCompleted().subscribe((workflow: Workflow) => {
              this.initMap(workflow.workflowId, queryParams);
            });
          }
        }
      });
    });
  }

  workflowRuleName(workflowId: string): string {
    if (this.optionsWorkflow) {
      let workflows: any[] = this.optionsWorkflow.filter((value: any) => {
        if (value.value == workflowId) {
          return value;
        }
      });
      if (workflows.length == 1) {
        return workflows[0].ruleName;  
      }
    }
    return Rule.AMMINISTRAZIONE_TRASPARENTE;
  }

  loadGeoJson(params: any) {
    this.options = undefined;
    this.isGEOLoaded = false;
    this.markerClusterData = [];
    this.getGeoJson()
      .subscribe({
        next: (geo: any) => {
          this.isGEOLoaded = true;
          let codiceIpa = params.codiceIpa;
          if (this.excludedCodiciIpa.has((codiceIpa || '').trim().toUpperCase())) {
            codiceIpa = undefined;
          }
          let result = geo.features || geo;
          result.forEach((element: any) => {
            let coordinates = element.geometry.coordinates;
            let lat = coordinates[1];
            let lng = coordinates[0];
            element.properties.companies.forEach((company: any) => {
              if (this.excludedCodiciIpa.has((company?.codiceIpa || '').trim().toUpperCase())) {
                return;
              }
              let status = this.workflowId ? company?.validazioni?.[this.ruleName] || 500 : undefined;
              let iconColor = this.workflowId ? ((status == 200 || status == 202) ? `success`: `danger` ) : `primary`;
              let icon = Leaflet.divIcon({
                html: `
                  <svg class="icon icon-white icon-sm bg-${iconColor}">
                    <use href="assets/vendor/sprite.svg#it-pa"></use>
                  </svg>
                `,
                iconSize: [25, 25],
                iconAnchor: [13, 7]            
              });
              let marker = Leaflet.marker(new Leaflet.LatLng(lat, lng), {
                icon: icon,
                codiceIpa: company.codiceIpa,
                denominazioneEnte: company.denominazioneEnte,
                status: status,
                that: this
              } as Leaflet.MarkerOptions).on('click', function(e) {
                var popup = e.target.getPopup();
                let options = e.sourceTarget.options;
                let zoom = options.that.map.getZoom();
                let workflowParams = options.that.workflowId ? `workflowId=${options.that.workflowId}&` :``;
                let description = `
                <div class="border-${iconColor}">
                  <strong>
                    <a href="${environment.baseHref}#/company-graph?${workflowParams}codiceIpa=${options.codiceIpa}&fromMap=true&zoom=${zoom}">${options.denominazioneEnte}</a>
                  </strong>
                </div>
              `;
                popup.setContent(description);
                popup.update();
              });
              marker.bindPopup("");
              this.markerClusterData.push(marker);
              if (codiceIpa && codiceIpa == company.codiceIpa) {
                this.center = new Leaflet.LatLng(lat, lng);
                this.zoom = params.zoom || CompanyMapComponent.ZOOM;
                this.currentMarker = marker;
              }
            });
          });
          this.options = {
            layers: this.getLayers(),
            preferCanvas: true
          };
          if (!codiceIpa && !params.nolocation) {
            this.getCurrentLocation();
          }
        },
        error: (err)=>{
          if (err?.httpErrorResponse?.status === 401) {
            if (environment.oidc.enable) {
              sessionStorage.setItem('redirect', this.router.url);
              this.router.navigateByUrl('/auth/signin', { state: { redirect: this.router.url } });
            } else {
              this.router.navigate(['error/unauthorized']);
            }
          }
          if (this.optionsRule.filter((value: any) => {
            if (value.value == this.ruleName) {
              return value;
            }
          }).length == 0) {
            this.filterFormSearch.controls.ruleName.patchValue(this.optionsRule[0].value);
          } else {
            this.apiMessageService.sendMessage(MessageType.ERROR,  `Dati non presenti, per il controllo con id ${this.workflowId}!`);
            this.isGEOLoaded = true;
            this.router.navigate(['error/not-found-no-back']);  
          }
        }
      });
  }

  getLayers(): Leaflet.Layer[] {
    return [
      new Leaflet.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      } as Leaflet.TileLayerOptions),
    ] as Leaflet.Layer[];
  };

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (position) {
              let lat = position.coords.latitude;
              let lng = position.coords.longitude;
              this.center = new Leaflet.LatLng(lat, lng);
              this.zoom = 15;
              const location = {
                lat,
                lng,
              };
              resolve(location);
            }
          },
          (error) => console.log(error)
        );
      } else {
        reject('Geolocation is not supported by this browser.');
      }
    });
  }
}
