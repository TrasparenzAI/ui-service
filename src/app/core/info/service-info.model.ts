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

    constructor(artifact: string, name: string, time: Date, version: string, group: string) {
        this.artifact = artifact;
        this.name = name;
        this.time = time;
        this.version = version;
        this.group = group;
    }
}

@JsonObject("Build")
export class Build {
    @JsonProperty('build', ServiceInfo)
    public build: ServiceInfo;
}
