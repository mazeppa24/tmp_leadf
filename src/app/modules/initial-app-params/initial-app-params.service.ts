import {inject, Injectable, signal} from "@angular/core";
import {ActivatedRoute, NavigationEnd, ParamMap, Router,} from "@angular/router";
import {filter, forkJoin, map, Observable, skipWhile, Subject, switchMap, take,} from "rxjs";
import {Agency, AgencyListService,} from "../../core/services/agency-list.service";

/**
 * The InitialAppParamsService gets certain query parameters on page load
 * and preserves them for later use in any component.
 *
 * This allows to navigate away with a Router while still having access to those parameters
 *
 * Please see interface InitialAppParams for details on which ones will be stored
 *
 * For correct results inject this service on application component level
 * otherwise it might have not catch the query parameters on the page load.
 * ```js
 @Component({
 selector: "app-root",
 templateUrl: "./app.component.html",
 styleUrls: ["./app.component.scss"],
 })
 export class AppComponent {
 private _initaialAppParamsService = inject(InitialAppParamsService)
 }
 ```
 */
@Injectable({
  providedIn: "root",
})
export class InitialAppParamsService {
  private activatedRoute = inject(ActivatedRoute);
  private agencyService = inject(AgencyListService);
  private router = inject(Router);
  private completionSubject = new Subject<string>();


  public completion$ = this.completionSubject.asObservable();
  /**
   * Initial Application Params gathered from the query parameters during page load
   */
  initialAppParams = signal<InitialAppParams>({
    debug: false,
    language: undefined,
    preselectedEmail: undefined,
    preselectedByDParam: false,
    campaign: undefined,
    externalLink: undefined,
    agency: undefined,
    campaignSource: undefined,
    werber: undefined,
  });

  constructor() {
    const initialSetup$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      take(1),
      switchMap(() => this.processInitialParameters()),
    );
    initialSetup$.subscribe({
      next: (params) => {
        this.initialAppParams.set(params);
        console.log('Initial parameters set:', params);
        this.completionSubject.next('completed');
      },
      error: (error) => {
        console.error(
          "Critical error occured during initial parameter initialization:",
          error,
        );
        this.completionSubject.next(error);
      },
    });
  }

  private processInitialParameters() {
    return forkJoin({
      params: this.activatedRoute.queryParamMap.pipe(take(1)),
      agencies: this.agencyService.getList().pipe(
        skipWhile((agencies) => agencies.length === 0),
        take(1),
      ),
    }).pipe(
      map(({params, agencies}) => this.parseParameters(params, agencies)),
    );
  }

  private parseParameters(
    params: ParamMap,
    agencies: Agency[],
  ): InitialAppParams {
    const agencyParam = params.get("ga");
    let agency: Agency | undefined;
    if (agencyParam) {
      agency = agencies.find((agency) => agency.id == agencyParam);
    }
    let email: string | undefined;
    try {
      email = atob(params.get("data_zp") || params.get("d") || "") || undefined;
    } catch (e) {
      console.warn("Invalid base64 email encoding:", e);
    }
    return {
      debug: params.get("debug") === "true",
      language: params.get("language") || undefined,
      preselectedEmail: email,
      preselectedByDParam: params.has("d"),
      campaign: params.get("cp") || undefined,
      externalLink: params.get("extLnk") || undefined,
      agency: agency,
      campaignSource: params.get('sc') || undefined,
      werber: params.get('we') || undefined,
    };
  }

  executeFirst(): Observable<string>{
    return this.completion$;
  }
}

/**
 * InitialAppParams object stores preserved query parameters under human readable name
 *
 * The following table describes which query parameter(s) is used for which field
 * |field                |query parameter|notes                                                                                      |
 * |---------------------|---------------|-------------------------------------------------------------------------------------------|
 * |`debug`              |`debug         |                                                                                           |
 * |`language` .         |`lang          |                                                                                           |
 * |`preselectedEmail` . |`data_zp`, `d` |`data_zp` is used before `d` parameter. they contain base64 encoded value which is decoded |
 * |`preselectedByDParam`|`d`            |true if d parameter is present in query params                                             |
 * |`campaign`           |`cp`           |                                                                                           |
 * |`externalLink` .     |`extLnk` .     |                                                                                           |
 * |`agency` .           |`ga`           |string value gets converted to Agency if valid                                             |
 */
interface InitialAppParams {
  debug: boolean; // debug
  language: string | undefined; // lang
  preselectedEmail: string | undefined; // data_zp, d
  preselectedByDParam: boolean; // d
  campaign: string | undefined; // from cp param
  externalLink: string | undefined; // extLnk
  agency: Agency | undefined; // ga
  campaignSource:string| undefined; // sc (&sc=)
  werber: string | undefined; // we (&we=)
}
