import _ from 'lodash'

export function capitalize(str: string): string {
  return _.capitalize(str)
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  return _.debounce(func, wait)
}
