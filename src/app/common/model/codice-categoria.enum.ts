import { EnumKeyConverter } from "../../common/helpers/EnumKeyConverter";

export enum CodiceCategoria {
  L10='Agenzie ed Enti per il Turismo',
  L19='Agenzie ed Enti Regionali del Lavoro',
  L13='Agenzie ed Enti Regionali di Sviluppo Agricolo',
  L2='Agenzie ed Enti Regionali per la Formazione, la Ricerca e l\'Ambiente',
  C10='Agenzie Fiscali',
  L20='Agenzie Regionali e Provinciale per la Rappresentanza Negoziale',
  L21='Agenzie Regionali per le Erogazioni in Agricoltura',
  L22='Agenzie Regionali Sanitarie',
  L15='Agenzie, Enti e Consorzi Pubblici per il Diritto allo Studio Universitario',
  L1='Altri Enti Locali',
  C13='Automobile Club Federati ACI',
  C5='Autorita\' Amministrative Indipendenti',
  L40='Autorita\' di Bacino',
  L11='Autorita\' Portuali',
  L39='Aziende e Consorzi Pubblici Territoriali per l\'Edilizia Residenziale',
  L46='Aziende ed Amministrazioni dello Stato ad Ordinamento Autonomo',
  L8='Aziende Ospedaliere, Aziende Ospedaliere Universitarie, Policlinici e Istituti di Ricovero e Cura a Carattere Scientifico Pubblici',
  L34='Aziende Pubbliche di Servizi alla Persona',
  L7='Aziende Sanitarie Locali',
  L35='Camere di Commercio, Industria, Artigianato e Agricoltura e loro Unioni Regionali',
  L45='Citta\' Metropolitane',
  L47='Commissari Straordinari Governativi',
  L6='Comuni e loro Consorzi e Associazioni',
  L12='Comunita\' Montane e loro Consorzi e Associazioni',
  L24='Consorzi di Bacino Imbrifero Montano',
  L28='Consorzi Interuniversitari di Ricerca',
  L42='Consorzi per l\'Area di Sviluppo Industriale',
  L36='Consorzi tra Amministrazioni Locali',
  C17='Enti di Previdenza ed Assistenza Sociale in Conto Economico Consolidato privati ',
  C16='Enti di Previdenza ed Assistenza Sociale in Conto Economico Consolidato pubblici',
  L44='Enti di Regolazione dei Servizi Idrici e o dei Rifiuti',
  C8='Enti e Istituzioni di Ricerca Pubblici',
  C3='Enti Pubblici Non Economici',
  C7='Enti Pubblici Produttori di Servizi Assistenziali, Ricreativi e Culturali ',
  C14='Federazioni Nazionali, Ordini, Collegi e Consigli Professionali',
  L16='Fondazioni Lirico, Sinfoniche',
  C11='Forze di Polizia ad Ordinamento Civile e Militare per la Tutela dell\'Ordine e della Sicurezza Pubblica',
  L37='Gestori di Pubblici Servizi',
  L33='Istituti di Istruzione Statale di Ogni Ordine e Grado',
  C12='Istituti Zooprofilattici Sperimentali',
  L43='Istituzioni per l\'Alta Formazione Artistica, Musicale e Coreutica - AFAM',
  C2='Organi Costituzionali e di Rilievo Costituzionale',
  L38='Parchi Nazionali, Consorzi e Enti Gestori di Parchi e Aree Naturali Protette',
  C1='Presidenza del Consiglio dei Ministri, Ministeri e Avvocatura dello Stato',
  L5='Province e loro Consorzi e Associazioni',
  L4='Regioni, Province Autonome e loro Consorzi e Associazioni',
  S01='Societa\' in Conto Economico Consolidato',
  SA='Stazioni Appaltanti',
  SAG='Stazioni Appaltanti Gestori di Pubblici Servizi',
  L31='Teatri Stabili ad Iniziativa Pubblica',
  L18='Unioni di Comuni e loro Consorzi e Associazioni',
  L17='Universita\' e Istituti di Istruzione Universitaria Pubblici'
}

export class CodiceCategoriaConverter extends EnumKeyConverter<CodiceCategoria> {
  constructor() {
      super(CodiceCategoria);
  }

  deserialize(data: any): CodiceCategoria {
    const result = super.deserialize(data);
    return <CodiceCategoria>(`${data} - ${result}` as any);
  }
}