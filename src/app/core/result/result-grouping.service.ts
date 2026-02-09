// data-grouping.service.ts - Servizio per raggruppare i dati

import { Injectable } from '@angular/core';
import { Result } from './result.model';

@Injectable({
  providedIn: 'root'
})
export class ResultGroupingService {

  /**
   * Raggruppa i dati per workflowId e data (senza ore/minuti/secondi)
   * e conta le occorrenze con status 200 o 202
   */
  groupByWorkflowAndDate(results: Result[]): GroupedData[] {
    // Mappa per raggruppare i dati
    const groupMap = new Map<string, number>();

    // Elabora ogni elemento nell'array content
    results.forEach((item: Result) => {
      // Tronca la data senza ore, minuti e secondi
      const truncatedDate = this.truncateDate(item.createdAt);
      
      // Crea una chiave composta da workflowId e data
      const key = `${item.workflowId}|${truncatedDate}`;
      
      // Incrementa il contatore per questa chiave
      const currentCount = groupMap.get(key) || 0;
      if (item.status === 200 || item.status === 202) {
        groupMap.set(key, currentCount + 1);
      } else {
        groupMap.set(key, currentCount);
      }
    });

    // Converti la mappa in un array di oggetti GroupedData
    const result: GroupedData[] = [];
    groupMap.forEach((count, key) => {
      const [workflowId, date] = key.split('|');
      result.push({
        workflowId,
        date,
        count
      });
    });

    // Ordina per data e workflowId
    return result.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.workflowId.localeCompare(b.workflowId);
    });
  }

  /**
   * Tronca la data rimuovendo ore, minuti e secondi
   */
  private truncateDate(date: Date): string {
    
    // Formato: YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Metodo alternativo: raggruppa e restituisce una struttura ad albero
   */
  groupByWorkflowAndDateTree(results: Result[]): Map<string, Map<string, number>> {
    const result = new Map<string, Map<string, number>>();

    results.forEach((item: Result) => {
      const truncatedDate = this.truncateDate(item.createdAt);
      
      // Ottieni o crea la mappa per questo workflowId
      if (!result.has(item.workflowId)) {
        result.set(item.workflowId, new Map<string, number>());
      }
      
      const dateMap = result.get(item.workflowId)!;
      const currentCount = dateMap.get(truncatedDate) || 0;
      if (item.status === 200 || item.status === 202) {
        dateMap.set(truncatedDate, currentCount + 1);
      } else {
        dateMap.set(truncatedDate, currentCount);
      }
    });

    return result;
  }

  /**
   * Raggruppa solo per workflowId (totale per workflow)
   */
  groupByWorkflowOnly(results: Result[]): Map<string, number> {
    const result = new Map<string, number>();

    results.forEach((item: Result) => {
      const currentCount = result.get(item.workflowId) || 0;
      if (item.status === 200 || item.status === 202) {
        result.set(item.workflowId, currentCount + 1);
      } else {
        result.set(item.workflowId, currentCount);
      }
    });
    return result;
  }

  /**
   * Raggruppa solo per data (totale per giorno)
   */
  groupByDateOnly(results: Result[]): Map<string, number> {
    const result = new Map<string, number>();

    results.forEach((item: Result) => {
      const truncatedDate = this.truncateDate(item.createdAt);
      const currentCount = result.get(truncatedDate) || 0;
      if (item.status === 200 || item.status === 202) {
        result.set(truncatedDate, currentCount + 1);
      } else {
        result.set(truncatedDate, currentCount);
      }
    });

    return result;
  }
}

export interface GroupedData {
  workflowId: string;
  date: string;
  count: number;
}