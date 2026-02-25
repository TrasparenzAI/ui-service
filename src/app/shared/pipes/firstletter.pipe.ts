import { Pipe, PipeTransform } from '@angular/core';
import {Helpers} from '../../common/helpers/helpers';

@Pipe({
    name: 'firstLetter',
    standalone: false
})
export class FirstLetterPipe implements PipeTransform {

  transform(value?: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      return '';
    }
    return Helpers.firstLetter(value);
  }

}
