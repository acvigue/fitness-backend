import { defineConfig } from 'vite';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    ssr: true,
    rollupOptions: {
      input: 'prisma/seed.ts',
      output: {
        format: 'es',
        entryFileNames: '[name].js',
      },
    },
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
  },
  resolve: {
    alias: {
      '~': '/src',
      '@': '/src',
    },
    extensions: ['.ts', '.js', '.json'],
  },
});
