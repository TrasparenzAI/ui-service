import { JsonProperty, JsonObject } from 'json2typescript';
import { Base } from '../../common/model/base.model';
import { StorageData } from '../result/result.model';

export class SelectRule {
    public parentKey: string;
    public key: string;
    public text: string;
    public level: number;

    constructor(parentKey: string, key: string, label: string, level: number) {
        this.level = level;
        this.parentKey = parentKey;
        this.key = key;
        this.text = label;
    }
}

export class RuleChart {
    public nodeId: string;
    public parentNodeId: string;
    public term: string;
    public alternativeTerm: string[];
    public childStatus : Number[];

    public status: number;
    public destinationUrl: string;
    public storageData: StorageData; 
    public color: string;
    public buttonColor: string;
    public ruleStatus: {};
    public updatedAt: Date;
    public workflowChildId: string;
    public score: number;
    public content: string;
    public dynamicColor: string;

    constructor(nodeId: string, parentNodeId: string, term: string, alternativeTerm?: string[], childStatus?: Number[]) {
        this.nodeId = nodeId;
        this.parentNodeId = parentNodeId;
        this.term = term;
        this.alternativeTerm = alternativeTerm;
        this.childStatus = childStatus;
        this.color = 'primary';
        this.buttonColor = 'primary';
    }
}

@JsonObject("Term")
export class Term {
    @JsonProperty('key')
    public key: string;
    @JsonProperty('code')
    public code: number;

    constructor(key: string, code: number) {
        this.key = key;
        this.code = code;
    }
}

@JsonObject("Rule")
export class Rule implements Base {
    public static AMMINISTRAZIONE_TRASPARENTE : string = 'amministrazione-trasparente';
    public static AMMINISTRAZIONE_TRASPARENTE_TERM : string = 'Amministrazione trasparente';

    @JsonProperty('term', [Term])
    public term: Term[] = [];
    @JsonProperty('childs')
    public childs: any;    

    public getKeys(parentKey: string, rule: Rule, key: string, array: SelectRule[], leveli: number): SelectRule[] {
        let level = leveli + 1;
        let result = array || [];        
        let childs : Map<String, Rule> = rule ? rule.childs : this.childs;
        if (key) {
            result.push(new SelectRule(
                parentKey,
                key,
                rule ? rule.term.filter(key => key.code == 200)[0].key : Rule.AMMINISTRAZIONE_TRASPARENTE_TERM, 
                level
            ));
        }
        if (childs) {
            Object.keys(childs).forEach((childkey) => {
                this.getKeys(key, childs[childkey], childkey, result, level);
            });
        } 
        return result;
    }

    public getCharts(rule: Rule|undefined, key: string, array: RuleChart[]): RuleChart[] {
        let result = array || [];        
        let childs : Map<String, Rule> = rule ? rule.childs : this.childs;
        if (childs) {
            Object.keys(childs).forEach((child) => {
                result.push(new RuleChart(child, key, this.term200(childs[child].term), this.term202(childs[child].term)));
                this.getCharts(childs[child], child, result);
            });
        } 
        if (key && !rule) {
            result.push(new RuleChart(key, null, this.term200(this.term), this.term202(this.term)));
        }
        return result;
    }

    public term200(terms: Term[]): string {
        return terms.filter(key => key.code === 200)[0].key;
    }

    public term202(terms: Term[]): string[] {
        return terms.filter(key => key.code === 202).map((term: Term) => {return term.key;});
    }

    getId(): string {
        return undefined;
    }
    
    hasId(): boolean {
        return true;
    }
  
}
