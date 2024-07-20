const chunk = (): void => {
  Object.defineProperty(Array.prototype, 'chunk', {
    // eslint-disable-next-line no-restricted-syntax
    value: function (chunkSize: number): never[] {
      const R = [];
      for (let i = 0; i < this.length; i += chunkSize) R.push(this.slice(i, i + chunkSize) as never);

      return R;
    },
  });
};

const first = (): void => {
  Object.defineProperty(Array.prototype, 'first', {
    // eslint-disable-next-line no-restricted-syntax
    value: function () {
      return this[0];
    },
  });
};

const clean = (): void => {
  Object.defineProperty(Array.prototype, 'clean', {
    // eslint-disable-next-line no-restricted-syntax
    value: function () {
      return this.map((x) => x);
    },
  });
};

export const initArrayPolyfills = (): void => {
  chunk();
  first();
  clean();
};

declare global {
  interface Array<T> {
    chunk(_chunkSize: number): never[];
    first(): T;
    clean(): never[];
  }
}
