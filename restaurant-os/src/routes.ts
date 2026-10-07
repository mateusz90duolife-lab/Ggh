import type { RouteDef } from './router.js';
import { forgotPage, loginPage, newPasswordPage } from './pages/auth.js';
import { dashboardPage } from './pages/dashboard.js';
import { auditPage, settingsPage, templatesPage, usersPage } from './pages/admin.js';
import { countPage, inventoryPage, productPage } from './pages/inventory.js';
import { catalogPage } from './pages/catalog.js';
import { categoriesPage, notificationsPage, suppliersPage } from './pages/manage.js';
import { morePage } from './pages/more.js';
import { newPurchasePage, purchasePage, shoppingPage } from './pages/shopping.js';
import { scannerPage } from './pages/scanner.js';
import { reportShortagePage, shortagesPage } from './pages/shortages.js';
import { tasksPage } from './pages/tasks.js';
import { todayPage } from './pages/today.js';

const ALL = ['owner', 'manager', 'employee'] as const;
const MGR = ['owner', 'manager'] as const;
const OWNER = ['owner'] as const;

// Kolejność ma znaczenie: „/zakupy/nowy” przed „/zakupy/:id”.
export const routes: RouteDef[] = [
  { pattern: '/login', title: 'Logowanie', page: loginPage, roles: 'public' },
  { pattern: '/zapomniane-haslo', title: 'Reset hasła', page: forgotPage, roles: 'public' },
  { pattern: '/nowe-haslo', title: 'Nowe hasło', page: newPasswordPage, roles: 'public' },

  { pattern: '/dzisiaj', title: 'Dzisiaj', page: todayPage, roles: [...ALL] },
  { pattern: '/zadania', title: 'Zadania', page: tasksPage, roles: [...ALL] },
  { pattern: '/braki', title: 'Braki', page: shortagesPage, roles: [...ALL] },
  { pattern: '/braki/nowy', title: 'Zgłoś brak', page: reportShortagePage, roles: [...ALL] },
  { pattern: '/magazyn', title: 'Magazyn', page: inventoryPage, roles: [...ALL] },
  { pattern: '/magazyn/:id', title: 'Produkt', page: productPage, roles: [...ALL] },
  { pattern: '/wiecej', title: 'Więcej', page: morePage, roles: [...ALL] },

  { pattern: '/dashboard', title: 'Dashboard', page: dashboardPage, roles: [...MGR] },
  { pattern: '/zakupy', title: 'Zakupy', page: shoppingPage, roles: [...MGR] },
  { pattern: '/zakupy/nowy', title: 'Nowy zakup', page: newPurchasePage, roles: [...MGR] },
  { pattern: '/zakupy/:id', title: 'Zakup', page: purchasePage, roles: [...MGR] },
  { pattern: '/skaner', title: 'Skaner paragonów', page: scannerPage, roles: [...MGR] },
  { pattern: '/katalog', title: 'Katalog produktów', page: catalogPage, roles: [...MGR] },
  { pattern: '/inwentaryzacja', title: 'Inwentaryzacja', page: countPage, roles: [...MGR] },
  { pattern: '/dostawcy', title: 'Dostawcy', page: suppliersPage, roles: [...MGR] },
  { pattern: '/kategorie', title: 'Kategorie', page: categoriesPage, roles: [...MGR] },
  { pattern: '/powiadomienia', title: 'Powiadomienia', page: notificationsPage, roles: [...MGR] },

  { pattern: '/pracownicy', title: 'Pracownicy', page: usersPage, roles: [...OWNER] },
  { pattern: '/szablony', title: 'Szablony zadań', page: templatesPage, roles: [...OWNER] },
  { pattern: '/ustawienia', title: 'Ustawienia', page: settingsPage, roles: [...OWNER] },
  { pattern: '/audyt', title: 'Historia zmian', page: auditPage, roles: [...OWNER] },
];
