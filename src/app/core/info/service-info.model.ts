import { ISODateTimeConverter } from "../../common/helpers/ISODateTimeConverter";
import { JsonObject, JsonProperty } from "json2typescript";

@JsonObject("ServiceInfo")
export class ServiceInfo {
    @JsonProperty('artifact')
    public artifact: string;
    @JsonProperty('name')
    public name: string;
    @JsonProperty('time', ISODateTimeConverter)
    public time: Date | undefined;
    @JsonProperty('version')
    public version: string | undefined;
    @JsonProperty('group')
    public group: string | undefined;
    @JsonProperty('connectionError', Boolean, true)
    public connectionError: boolean;

    constructor(
        artifact: string,
        name: string,
        time?: Date,
        version?: string,
        group?: string,
        connectionError: boolean = false
    ) {
        this.artifact = artifact;
        this.name = name;
        this.time = time;
        this.version = version;
        this.group = group;
        this.connectionError = connectionError;
    }
}

@JsonObject("Build")
export class Build {
    @JsonProperty('build', ServiceInfo)
    public build: ServiceInfo;
}
