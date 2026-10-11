/** react-native-web's Alert is a no-op, so the web build uses the browser dialog. */
export function confirm(title: string, message: string): Promise<boolean> {
  return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true);
}
