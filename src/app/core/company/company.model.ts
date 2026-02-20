import { JsonProperty, JsonObject } from 'json2typescript';
import { ISODateTimeConverter } from '../../common/helpers/ISODateTimeConverter';
import { Base } from '../../common/model/base.model';
import { CodiceCategoriaConverter } from '../../common/model/codice-categoria.enum';

@JsonObject("Company")
export class Company implements Base {
    @JsonProperty('id')
    public id: number; 
    @JsonProperty('acronimo')
    public acronimo: string;    
    @JsonProperty('codiceCategoria', CodiceCategoriaConverter, true)
    public codiceCategoria: string;
    @JsonProperty('codiceFiscaleEnte')
    public codiceFiscaleEnte: string;
    @JsonProperty('codiceIpa')
    public codiceIpa: string;
    @JsonProperty('codiceNatura')
    public codiceNatura: string;
    @JsonProperty('denominazioneEnte')
    public denominazioneEnte: string;
    @JsonProperty('sitoIstituzionale')
    public sitoIstituzionale: string;
    @JsonProperty('sorgente')
    public sorgente: string;
    @JsonProperty('tipologia')
    public tipologia: string;
    @JsonProperty('codiceComuneIstat')
    public codiceComuneIstat: string;
    @JsonProperty('codiceCatastaleComune')
    public codiceCatastaleComune: string;
    @JsonProperty('cap')
    public cap: string;
    @JsonProperty('indirizzo')
    public indirizzo: string;
    @JsonProperty('nomeResponsabile')
    public nomeResponsabile: string;
    @JsonProperty('cognomeResponsabile')
    public cognomeResponsabile: string;
    @JsonProperty('titoloResponsabile')
    public titoloResponsabile: string;
    @JsonProperty('mail1')
    public mail1: string;
    @JsonProperty('tipoMail1')
    public tipoMail1: string;
    @JsonProperty('mail2')
    public mail2: string;
    @JsonProperty('tipoMail2')
    public tipoMail2: string;
    @JsonProperty('mail3')
    public mail3: string;
    @JsonProperty('tipoMail3')
    public tipoMail3: string;
    @JsonProperty('mail4')
    public mail4: string;
    @JsonProperty('tipoMail4')
    public tipoMail4: string;
    @JsonProperty('mail5')
    public mail5: string;
    @JsonProperty('tipoMail5')
    public tipoMail5: string;
    @JsonProperty('denominazioneComune')
    public denominazioneComune: string;
    @JsonProperty('denominazioneUnitaSovracomunale')
    public denominazioneUnitaSovracomunale: string;
    @JsonProperty('denominazioneRegione')
    public denominazioneRegione: string;
    @JsonProperty('dataAggiornamento', ISODateTimeConverter)
    public dataAggiornamento: Date;
    @JsonProperty('dataCancellazione', ISODateTimeConverter)
    public dataCancellazione: Date;
    @JsonProperty('createdAt', ISODateTimeConverter)
    public createdAt: Date;
    @JsonProperty('updatedAt', ISODateTimeConverter)
    public updatedAt: Date;
    @JsonProperty('visibile')
    public visibile: boolean;

    constructor() {}

    getId(): string {
        return String(this.id);
    }

    hasId(): boolean {        
        return this.getId() !== undefined;
    }

    public get fullIndirizzo() {
        return `${this.indirizzo} - ${this.cap} - ${this.denominazioneComune}`;
    }

    public get responsabile() {
        return `${this.nomeResponsabile} ${this.cognomeResponsabile}`;
    }


}
