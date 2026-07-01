import { ISODateTimeConverter } from "../../common/helpers/ISODateTimeConverter";
import { JsonObject, JsonProperty } from "json2typescript";

@JsonObject("ServiceInfo")
export class ServiceInfo {
    @JsonProperty('artifact')
    public artifact: string;
    @JsonProperty('name')
    public name: string;
    @JsonProperty('time', ISODateTimeConverter)
    public time: Date;
    @JsonProperty('version')
    public version: string;
    @JsonProperty('group')
    public group: string;
    @JsonProperty('status', String, true)
    public status?: string;

    constructor(artifact: string, name: string, time: Date|undefined, version: string|undefined, group: string|undefined, status?: string) {
        this.artifact = artifact;
        this.name = name;
        this.time = time;
        this.version = version;
        this.group = group;
        this.status = status;
    }
}

@JsonObject("Build")
export class Build {
    @JsonProperty('build', ServiceInfo)
    public build: ServiceInfo;
}

@JsonObject("IndicePaUpdateRecord")
export class IndicePaUpdateRecord {
    @JsonProperty('id')
    public id!: number;
    @JsonProperty('updateDate', ISODateTimeConverter)
    public updateDate!: Date;
    @JsonProperty('updatedFrom')
    public updatedFrom!: string;
    @JsonProperty('totalIndicePaCompanies')
    public totalIndicePaCompanies!: number;
    @JsonProperty('processedCompanies')
    public processedCompanies!: number;
    @JsonProperty('totalActiveCompanies')
    public totalActiveCompanies!: number;
    @JsonProperty('totalVisibleCompanies')
    public totalVisibleCompanies!: number;
    @JsonProperty('insertedCompanies')
    public insertedCompanies!: number;
    @JsonProperty('modifiedCompanies')
    public modifiedCompanies!: number;
    @JsonProperty('deletedCompanies')
    public deletedCompanies!: number;
}
