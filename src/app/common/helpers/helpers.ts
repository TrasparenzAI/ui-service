
import {AbstractControlDirective, NgControl, ValidationErrors, ValidatorFn, AbstractControl} from '@angular/forms';
import {Enum} from '../model/enum.model';
import {DatePipe} from '@angular/common';
import {JsonConvert, ValueCheckingMode} from 'json2typescript';

export class Helpers {
  public static regExpCodiceFiscale: RegExp = /^(?:[A-Z][AEIOU][AEIOUX]|[B-DF-HJ-NP-TV-Z]{2}[A-Z]){2}(?:[\dLMNP-V]{2}(?:[A-EHLMPR-T](?:[04LQ][1-9MNP-V]|[15MR][\dLMNP-V]|[26NS][0-8LMNP-U])|[DHPS][37PT][0L]|[ACELMRT][37PT][01LM]|[AC-EHLMPR-T][26NS][9V])|(?:[02468LNQSU][048LQU]|[13579MPRTV][26NS])B[26NS][9V])(?:[A-MZ][1-9MNP-V][\dLMNP-V]{2}|[A-M][0L](?:[1-9MNP-V][\dLMNP-V]|[0L][1-9MNP-V]))[A-Z]$/i;
  public static ITALIA: string = 'Italia';

  public static buildInstance(json: any, obj: any): any {
    let jsonConvert: JsonConvert = new JsonConvert();
        jsonConvert.ignorePrimitiveChecks = false; // don't allow assigning number to string etc.
        jsonConvert.valueCheckingMode = ValueCheckingMode.ALLOW_NULL; // never allow null
        
    return jsonConvert.deserializeObject(json, obj);
  }

  public static capitalizeName(value: string) {
    let result = '';
    const terms = value.split(' ');
    if (terms) {
      terms.forEach( (term) => {
        if (term.indexOf('\'') > 0) {
          const a = term.split('\'')[0];
          const b = term.split('\'')[1];
          result = result + Helpers.capitalizeWord(a) + '\'' + Helpers.capitalizeWord(b);
        } else {
          result = result + term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
        }
        result = result + ' ';
      });
    }
    return result;
  }

  public static capitalizeWord(word: string) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  public static firstLetter(word?: string) {
    if (!word) {
      return '';
    }
    return word.charAt(0).toUpperCase();
  }

  public static addDays(date: Date, noOfDays: number): Date {
    if (date === null) {
      return null;
    }
    return new Date(date.getTime() + (noOfDays * (1000 * 60 * 60 * 24)));
  }

  public static formatDate(date: Date): string {
    if (date === null) {
      return null;
    }
    if (String(date) === 'Invalid Date') {
      return '';
    }
    return new DatePipe('en-US').transform(date,"yyyy-MM-dd");
  }

  public static showDate(date: Date): string {
    if (date === null) {
      return null;
    }
    return new DatePipe('en-US').transform(date,"dd/MM/yyyy");
  }

  public static formatDateView(date: Date): string {
    if (date === null) {
      return null;
    }
    return new DatePipe('en-US').transform(date,"dd/MM/yyyy");
  }

  public static formatDateTimeView(date: Date): string {
    if (date === null) {
      return null;
    }
    return new DatePipe('en-US').transform(date,"dd-MM-yyyy HH:mm:ss");
  }

  public static getLabelFromControl(label: string, controlDir: NgControl): string {
    if (label == null) {
      const abstractControl = (<AbstractControlDirective>controlDir).control;
      const formGroup = abstractControl.parent.controls;
      return Object.keys(formGroup).find(name => abstractControl === formGroup[name]) || null;
    }
    return label;
  }

  public static buildDate(value): Date {
    return !value || value instanceof Date ? value : new Date(value);
  }

  /**
   * Stesso oggetto ma con:
   * Base value: id
   * Enum value: enumValue
   * Applicazione: Post e Put Http.
   */
  public static objToJsonObj(obj): {} {
    const jsonObj = {};
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value instanceof Array) {
        jsonObj[key] = [];
        value.forEach( item => {
          jsonObj[key].push(Helpers.valueToJson(item));
        });
        return;
      } else {
        jsonObj[key] = Helpers.valueToJson(value);
      }
    });
    return jsonObj;
  }

   /**
   * Stesso oggetto ma con:
   * Base value: id
   * Enum value: enumValue
   * Applicazione: Post e Put Http.
   */
  public static objToFormData(obj): FormData {
    const formData: FormData = new FormData();
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value) {
        if (value instanceof Array) {
          value.forEach( item => {
            formData.append(key, Helpers.valueToJson(item));
          });
          return;
        } else {
          formData.append(key, Helpers.valueToJson(value));
        }  
      }
    });
    return formData;
  }

  public static objToQueryParam(obj) {
    let s = '';
    if (!obj) {
      return s;
    }
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value instanceof Array) {
        value.forEach( item => {
          s = s + '&' + key + '=' + Helpers.valueToJson(item);
        });
        return;
      } else {
        s = s + '&' + key + '=' + Helpers.valueToJson(value);
      }
    });
    return s;
  }

  public static valueToJson(value) {
    if (value === null || value === undefined) {
      return;
    }
    if (value instanceof Enum) {
      return value.getEnumValue();
    }
    if (value instanceof Date) {
      return Helpers.formatDate(value);
    }
    return value;
  }

  static patternValidator(regex: RegExp, error: ValidationErrors): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } => {
      if (!control.value) {
        // if control is empty return no error
        return null;
      }
  
      // test the value of the control against the regexp supplied
      const valid = regex.test(control.value);
  
      // if true, return no error (no error), else return error passed in the second parameter
      return valid ? null : error;
    };
  }

  static minlengthValidator(minlength: number, error: ValidationErrors): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } => {
      if (!control.value) {
        // if control is empty return no error
        return null;
      }
  
      // test the value of the control against the regexp supplied
      const valid = String(control.value).length >= minlength;
  
      // if true, return no error (no error), else return error passed in the second parameter
      return valid ? null : error;
    };
  }

  static maxlengthValidator(maxlength: number, error: ValidationErrors): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } => {
      if (!control.value) {
        // if control is empty return no error
        return null;
      }
  
      // test the value of the control against the regexp supplied
      const valid = String(control.value).length <= maxlength;
  
      // if true, return no error (no error), else return error passed in the second parameter
      return valid ? null : error;
    };
  }

  static lengthValidator(length: number, error: ValidationErrors): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } => {
      if (!control.value) {
        // if control is empty return no error
        return null;
      }
  
      // test the value of the control against the regexp supplied
      const valid = String(control.value).length == length;
  
      // if true, return no error (no error), else return error passed in the second parameter
      return valid ? null : error;
    };
  }

  static maxLengthArrayValidator(maxlength: number, error: ValidationErrors): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } => {
      if (!control.value) {
        // if control is empty return no error
        return null;
      }
  
      // test the value of the control against the regexp supplied
      const valid = control.value.length <= maxlength;
  
      // if true, return no error (no error), else return error passed in the second parameter
      return valid ? null : error;
    };
  }
  
  /**
   * generate groups of 4 random characters
   * @example getUniqueId(1) : 607f
   * @example getUniqueId(2) : 95ca-361a-f8a1-1e73
   */
  static getUniqueId(parts: number): string {
    const stringArr = [];
    for(let i = 0; i< parts; i++){
      // tslint:disable-next-line:no-bitwise
      const S4 = (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
      stringArr.push(S4);
    }
    return stringArr.join('-');
  }

  static convertProperties(obj: any) : any {
    // iterate over the property names
    Object.keys(obj).forEach(function(k) {
      var prop = k.split('.');
      var last = prop.pop();
      if (prop.length > 0) {
        prop.reduce(function(o, key) {
          return o[key] = o[key] || {};
        }, obj)[last] = obj[k];
        delete obj[k];  
      }
    });
    return obj;    
  }

  /**
   * A function that iterates through the computed style properties of a HTML
   * element and redefines them as inline styles.
   */
  static computedStyleToInlineStyle(
    element: HTMLElement | SVGElement,
    options?: {
      recursive?: boolean;
      properties?: string[];
    }
  ): void {
    if (!element) {
      throw new Error('No element specified.');
    }

    if (options?.recursive) {
      Array.prototype.forEach.call(element.children, (child) => {
        Helpers.computedStyleToInlineStyle(child, options);
      });
    }

    const computedStyle = getComputedStyle(element);
    Array.prototype.forEach.call(
      options?.properties || computedStyle,
      (property) => {
        element.style[property] = computedStyle.getPropertyValue(property);
      }
    );
  }
  
}
