import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      // 單元測試與原始碼並排(co-located),見 openspec/decisions.md 的檔案組織決策
      'src/**/*.test.ts',
      'ui/**/*.test.ts',
      'shared/**/*.test.ts',
      // 不對應單一原始檔的測試——驗的是 repo 資料而非某支程式
      'tests/**/*.test.ts',
    ],
  },
});
