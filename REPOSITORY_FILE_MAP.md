# Repository file map — 10 October 2026

Companion to `REPOSITORY_INSPECTION.md`, indexed at commit `9a0652f`. This is a source navigation map, not proof that every branch has been executed. All 131 TypeScript/TSX files parsed without syntax diagnostics. Function names and line numbers are extracted from source; inline callbacks are omitted. Table and API references are literal occurrences and may be empty when a file delegates to another layer.

## TypeScript / TSX source

| File | Lines | Named functions | Literal table / API references |
|---|---:|---|---|
| `src/app/admin/categories/page.tsx` | 241 | CategoriesEditor:25, startEdit:42, cancelEdit:43, saveEdit:45, handleAdd:54, handleDelete:63, moveCategory:65, isSpecial:73, InputField:228 |  |
| `src/app/admin/layout.tsx` | 763 | AdminLayout:93, lockOrientation:125, onFullscreenChange:139, check:146, handleInstall:152, getHref:185, isItemActive:191, handleSwitchRestaurant:284, handleLogout:296 |  |
| `src/app/admin/login/page.tsx` | 123 | AdminLoginPage:22, onSuccess:46 |  |
| `src/app/admin/page-content/page.tsx` | 1439 | ColorPicker:246, OptionSelector:320, ToggleSwitch:356, CardLayoutPreview:391, PageContentEditor:445, toggleSection:501, toggleDesign:509, handleChange:517, handleStyleChange:521, handleSave:525, handleResetSection:545, handleResetAll:551, renderDesignFields:562 |  |
| `src/app/admin/page.tsx` | 769 | AdminDashboard:67, handleClickVenue:85, getVenueUserBreakdown:152, handleCreate:166, handleDelete:191, formatDate:204, formatTimeAgo:213 |  |
| `src/app/admin/products/page.tsx` | 620 | blankProduct:14, blankAddon:26, blankVariationOption:32, blankVariation:38, ProductsEditor:45, toggleCategory:61, startAdd:72, startEdit:78, cancelEdit:86, saveProduct:88, handleDelete:97, addAddon:103, updateAddonField:108, removeAddon:116, addVariation:122, removeVariation:127, updateVariationField:132, addVariationOption:140, updateVariationOption:150, removeVariationOption:160, getProductsByCategory:171, moveProduct:176, matchesSearch:194, matchesCategory:197, Field:604 |  |
| `src/app/admin/restaurant/page.tsx` | 178 | RestaurantEditor:10, handleChange:23, handleSave:27 |  |
| `src/app/admin/[venue]/bar/page.tsx` | 207 | BarStationPage:16, requestWakeLock:35, handleVisibility:47, toggleMute:61, onFullscreenChange:93, onVisibility:102 |  |
| `src/app/admin/[venue]/categories/page.tsx` | 247 | CategoriesEditor:26, startEdit:45, cancelEdit:46, saveEdit:48, handleAdd:58, handleDelete:68, moveCategory:70, isSpecial:79, InputField:234 |  |
| `src/app/admin/[venue]/inventory/page.tsx` | 656 | todayLocalStartIso:16, formatTodayDate:22, formatTime:30, reasonLabel:35, InventoryPage:42, handleAdd:155, confirmAdjust:182, removeRow:216, copyReportText:226 | API: /api/inventory/adjust |
| `src/app/admin/[venue]/kitchen/page.tsx` | 16 | KitchenStationPage:7 |  |
| `src/app/admin/[venue]/layout.tsx` | 86 | VenueLayout:13 |  |
| `src/app/admin/[venue]/orders/page.tsx` | 1059 | tabPaymentLabel:35, isTabCardPayment:42, rangeBounds:47, inRange:70, formatTime:119, formatDate:124, formatDateTime:134, timeAgo:138, AdminOrdersPage:148, exportCsv:260, getNextStatus:282, nextActionLabel:288 |  |
| `src/app/admin/[venue]/page-content/page.tsx` | 1743 | ColorPicker:252, OptionSelector:326, ToggleSwitch:362, CardLayoutPreview:397, PageContentEditor:451, toggleSection:511, toggleDesign:519, handleChange:527, handleStyleChange:531, handleSave:535, handleResetSection:556, handleResetAll:562, isSectionVisible:573, renderDesignFields:630 |  |
| `src/app/admin/[venue]/page.tsx` | 186 | VenueRolePicker:58, onLoginSuccess:85 |  |
| `src/app/admin/[venue]/products/page.tsx` | 1973 | blankProduct:41, blankAddon:53, blankVariationOption:59, categoryForSave:67, blankVariation:72, blankHappyHourForm:92, scheduleProductMap:100, ProductsEditor:115, isSpecialCat:181, startCatEdit:183, cancelCatEdit:184, saveCatEdit:186, handleCatAdd:196, handleCatDelete:206, moveCat:208, toggleCategory:217, loadInventoryRows:235, loadHappyHours:245, startAdd:267, openProductCatModal:277, saveQuickCategory:282, startEdit:301, cancelEdit:310, saveProduct:317, openHappyHourForm:391, saveHappyHour:413, deleteHappyHour:450, confirmTrackingChange:464, handleDelete:495, addAddon:502, updateAddonField:507, removeAddon:515, dependencyValue:529, parseDependency:532, addVariation:539, removeVariation:544, updateVariationField:549, addVariationOption:557, updateVariationOption:567, removeVariationOption:577, getProductsByCategory:588, moveProduct:593, matchesSearch:612, matchesCategory:615, Field:1943, CatField:1960 | API: /api/inventory/adjust |
| `src/app/admin/[venue]/restaurant/page.tsx` | 224 | RestaurantEditor:13, handleChange:28, handleSave:32 |  |
| `src/app/admin/[venue]/restaurants/page.tsx` | 16 | RestaurantsPage:9 |  |
| `src/app/admin/[venue]/settings/page.tsx` | 142 | VenueSettingsPage:10, setOrderingEnabled:22 |  |
| `src/app/admin/[venue]/shifts/page.tsx` | 1128 | todayIso:63, pad:65, isoFromDate:69, pad:70, addDays:74, getMondayOfWeek:80, getWeekDates:88, jsDayToIsoDay:92, exportSummaryCsv:98, rosterToDrafts:125, ShiftsPage:135, toggleRosterAssignee:286, saveRoster:298, updateChangeTime:334, addChangeTime:338, removeChangeTime:342, saveSettingsDay:346, openSummary:394, goToWeek:420 | API: /api/shifts/roster; API: /api/shifts/schedule |
| `src/app/admin/[venue]/tables/page.tsx` | 282 | TablesPage:14, suggestLabel:47, handleCreate:52, startEdit:70, saveEdit:76, deactivate:90 |  |
| `src/app/admin/[venue]/users/page.tsx` | 783 | UsersPage:44, handleInvite:89, copyInviteCode:136, copyPinResetCode:140, handlePinResetOtp:144, handleReinvite:160, persistRestaurantRole:185, persistRemoveAccess:198, handleDelete:207 |  |
| `src/app/admin/[venue]/waiter/page.tsx` | 456 | WaiterFloorPage:17, requestWakeLock:79, handleVisibility:91, tabForTable:110, openBacklogSheet:140, toggleBacklogItem:145, activateSelectedBacklog:157, handleTableTap:174, startTab:188, endShift:202 | API: /api/tabs/discard-empty |
| `src/app/admin/[venue]/waiter/[tabId]/page.tsx` | 525 | WaiterTabPage:17, addProduct:109, removeItem:130, activateBacklogItems:140, signOutAndExit:154, discardEmptyAndExit:166, handleGotovo:198, closeWithPayment:206 | API: /api/tabs/discard-empty; API: /api/tabs/close |
| `src/app/api/admin/users/invite/route.ts` | 146 | POST:24 | table: restaurant_access; table: users |
| `src/app/api/admin/users/pin-reset/route.ts` | 78 | POST:9 | table: restaurant_access; table: users |
| `src/app/api/auth/login/route.ts` | 99 | POST:7 | table: users |
| `src/app/api/auth/login-mode/route.ts` | 66 | POST:8 | table: users |
| `src/app/api/auth/logout/route.ts` | 17 | POST:6 | table: sessions |
| `src/app/api/auth/reset-pin/route.ts` | 62 | POST:8 | table: users |
| `src/app/api/auth/session/route.ts` | 49 | GET:7 | table: sessions; table: users; table: restaurant_access |
| `src/app/api/inventory/adjust/route.ts` | 83 | POST:6 |  |
| `src/app/api/shifts/history/route.ts` | 34 | GET:7 |  |
| `src/app/api/shifts/roster/route.ts` | 67 | GET:8, PUT:35 |  |
| `src/app/api/shifts/schedule/route.ts` | 74 | GET:12, PUT:42 |  |
| `src/app/api/shifts/summary/route.ts` | 42 | GET:7 |  |
| `src/app/api/tabs/close/route.ts` | 42 | isPaymentMethod:9, POST:13 |  |
| `src/app/api/tabs/closed/route.ts` | 57 | canViewVenueOrders:8, normalizeDateParam:22, GET:29 | table: restaurant_access |
| `src/app/api/tabs/discard-empty/route.ts` | 98 | getRestaurantRole:16, canCleanVenue:28, POST:32 | table: restaurant_access |
| `src/app/api/upload/route.ts` | 60 | POST:16 |  |
| `src/app/api/venue/save/route.ts` | 33 | POST:7 |  |
| `src/app/api/waiter/pin-login/route.ts` | 45 | POST:8 | table: users |
| `src/app/api/waiter/set-pin/route.ts` | 39 | POST:8 | table: users |
| `src/app/api/waiter/verify-pin/route.ts` | 56 | POST:8 | table: users |
| `src/app/api/[venue]/import-menu/route.ts` | 125 | toProductItems:24, POST:32 |  |
| `src/app/layout.tsx` | 30 | RootLayout:9 |  |
| `src/app/page.tsx` | 213 | VenuePickerPage:34 |  |
| `src/app/[venue]/cart/page.tsx` | 243 | CartPage:14 |  |
| `src/app/[venue]/checkout/page.tsx` | 560 | CheckoutPage:25, handleConfirm:83 |  |
| `src/app/[venue]/layout.tsx` | 117 | SessionToast:10, TableSessionManager:29, VenueLayout:66 |  |
| `src/app/[venue]/page.tsx` | 720 | MenuPage:47, heroMedia:149, anim:185, renderHero:198, renderInfoBar:282, renderPromoBanner:318, renderSearchBar:358, renderCategoryBar:400, renderFeaturedSection:521, renderMenuContent:574, renderSocialProof:587, renderFooter:636 |  |
| `src/app/[venue]/product/[id]/page.tsx` | 1628 | ProductPage:56, hasSelectedDependency:101, visibleVariationOptions:106, addonGroupKey:111, addonGroupLabel:112, addonGroupLimit:113, addonGroupMin:114, selectedAddonCountForGroup:116, setAddonQuantity:119, toggleAddon:140, anim:194, isDark:215, handleAddToOrder:272, renderHeroImage:337, renderInfoCard:464, renderVariationsInline:619, selectionBounds:627, renderLimitLabel:632, toggle:644, renderBadge:662, renderAddons:1058, renderQuantity:1274, renderRelated:1383, renderStickyBar:1487 |  |
| `src/components/admin/AdminLoginForm.tsx` | 277 | AdminLoginForm:24, resetToEmail:40, handleEmailContinue:49, handlePasswordLogin:72, handleInviteActivate:86, ErrorBox:272 |  |
| `src/components/admin/AdminPWA.tsx` | 52 | ensureMeta:14, AdminPWA:22, handler:42 |  |
| `src/components/admin/AdminQuickLogin.tsx` | 185 | avatarColor:19, UserAvatar:23, AdminQuickLogin:46, handlePin:55 |  |
| `src/components/admin/BarActiveTabs.tsx` | 148 | clearedKey:9, loadCleared:13, saveCleared:23, BarActiveTabs:27, markClear:72 |  |
| `src/components/admin/BsCollapse.tsx` | 61 | BsCollapse:18 |  |
| `src/components/admin/DataStorageNotice.tsx` | 15 | DataStorageNotice:4 |  |
| `src/components/admin/ImageUploadField.tsx` | 118 | ImageUploadField:19, handleFile:32 | API: /api/upload |
| `src/components/admin/LivePreview.tsx` | 254 | LivePreview:18, calculateScale:36, onMessage:60, handleIframeLoad:88 |  |
| `src/components/admin/PinPad.tsx` | 116 | PinPad:15, appendDigit:33, backspace:42 |  |
| `src/components/admin/PinResetWithOtp.tsx` | 146 | PinResetWithOtp:13, submitNewPin:22 |  |
| `src/components/admin/StationOrdersBoard.tsx` | 360 | formatTime:37, paymentBadgeLabel:41, nextStatus:47, ItemLines:53, OrderCard:93, StationOrdersBoard:269 |  |
| `src/components/admin/TableQrModal.tsx` | 143 | TableQrModal:18, handleDownload:48, handlePrint:58 |  |
| `src/components/admin/WaiterPicker.tsx` | 208 | avatarColor:27, WaiterPicker:31, goBack:48, completeLogin:54, submitPin:66 | API: /api/waiter/set-pin; API: /api/waiter/verify-pin |
| `src/components/LanguageSwitcher.tsx` | 74 | LanguageSwitcher:12 |  |
| `src/components/MenuItemCard.tsx` | 470 | MenuItemCard:24, handleQuickAdd:46 |  |
| `src/components/MenuList.tsx` | 203 | MenuSection:17, MenuList:102 |  |
| `src/components/OrderBar.tsx` | 104 | OrderBar:15 |  |
| `src/components/OrderItem.tsx` | 148 | OrderItem:15 |  |
| `src/components/QuantitySelector.tsx` | 42 | QuantitySelector:13 |  |
| `src/data/restaurants.ts` | 33 |  |  |
| `src/hooks/useAdminSession.ts` | 46 | useAdminSession:9 |  |
| `src/hooks/useCmsData.ts` | 130 | useCmsData:30, handler:74 |  |
| `src/hooks/useDbUsers.ts` | 28 | useDbUsers:9 |  |
| `src/hooks/useHappyHourPricing.ts` | 45 | useHappyHourPricing:11 |  |
| `src/hooks/useOrders.ts` | 93 | useOrders:8 |  |
| `src/hooks/useTranslation.ts` | 105 | useTranslation:23, t:27, tProduct:38, tCategory:50, tRestaurant:58, tAddon:71, tVariation:79, tVariationOption:87 |  |
| `src/hooks/useVenueCloudSync.ts` | 56 | withTimeout:8, useVenueCloudSync:18 |  |
| `src/hooks/useWaiterIdleTimeout.ts` | 50 | useWaiterIdleTimeout:9, bump:21 |  |
| `src/lib/admin-branding.ts` | 32 | venueLoginTitle:13 |  |
| `src/lib/auth/constants.ts` | 8 |  |  |
| `src/lib/auth/cookies.ts` | 41 | sessionCookieOptions:3, buildSessionCookie:14, clearSessionCookie:27, readSessionTokenFromCookie:31 |  |
| `src/lib/auth/create-session.ts` | 50 | createAuthSessionResponse:7 | table: users; table: restaurant_access; table: sessions |
| `src/lib/auth/invite-otp.ts` | 27 | generateInviteOtp:7, hashInviteOtp:12, verifyInviteOtp:17, inviteExpiresAt:22 |  |
| `src/lib/auth/map-user.ts` | 39 | normalizeRole:12, mapApiUserToAppUser:20 |  |
| `src/lib/auth/password.ts` | 18 | hashPassword:5, verifyPassword:9, isBcryptHash:15 |  |
| `src/lib/auth/pin-reset-otp.ts` | 26 | generatePinResetOtp:6, hashPinResetOtp:11, verifyPinResetOtp:16, pinResetExpiresAt:21 |  |
| `src/lib/auth/require-session.ts` | 37 | getSessionUserFromRequest:13 | table: sessions; table: users |
| `src/lib/auth/session-token.ts` | 10 | createSessionToken:3, hashSessionToken:7 |  |
| `src/lib/auth/shift-access.ts` | 37 | getRestaurantRole:7, canManageShifts:23, canViewShiftSummary:31 | table: restaurant_access |
| `src/lib/bar-notification-sound.ts` | 44 | playBarChime:3, isBarSoundMuted:35, setBarSoundMuted:40 |  |
| `src/lib/color-utils.ts` | 45 | isDark:2, mutedText:11, subtleBorder:16, subtleSurface:21, hoverSurface:26, adjustBrightness:31, adjust:36, contrastText:42 |  |
| `src/lib/date-format.ts` | 63 | parseIsoDate:26, formatDateShort:31, formatDateMedium:37, formatDateLong:43, formatWeekRange:49, formatDateTime:57 |  |
| `src/lib/fetch-with-timeout.ts` | 20 | fetchWithTimeout:2 |  |
| `src/lib/order-stations.ts` | 32 | itemsForKitchen:7, itemsForBar:12, itemsFoodOnlyOnBar:17, hasKitchenItems:21, hasBarItems:25, lineTotal:29 |  |
| `src/lib/orders/map.ts` | 18 | orderRowToOrder:5 |  |
| `src/lib/permissions.ts` | 184 | isPlatformAdmin:19, getRestaurantRole:23, canAccessRestaurant:32, getAccessibleRestaurantIds:38, canAccessPlatformAdmin:48, canManageVenueCms:53, canManageVenueStaff:58, canViewKitchenStation:63, canViewBarStation:73, canViewOrdersList:83, canManageTables:93, canViewWaiterMode:98, canManageInventory:108, canManageShifts:114, canViewShiftSummary:120, isStationRoute:125, isStationOnlyRole:129, getDefaultVenuePath:133, getDefaultPlatformPath:143, visibleVenueNavItems:150, platformRoleLabel:170, restaurantRoleLabel:174 |  |
| `src/lib/qrcode-loader.ts` | 48 | loadQrCodeScript:12, renderQrCode:33, qrCanvasFromContainer:45 |  |
| `src/lib/shift-segments.ts` | 89 | normalizeTime:3, parseTimeToMinutes:10, segmentLabel:15, segmentsToChangeTimes:22, buildSegmentsFromChangeTimes:32, validateChangeTimes:54, previewSegmentsFromChangeTimes:80 |  |
| `src/lib/storage/constants.ts` | 18 | publicStorageUrl:13 |  |
| `src/lib/storage/paths.ts` | 37 | sanitizeRestaurantFolder:4, sanitizeFileName:13, buildStorageObjectPath:28 |  |
| `src/lib/supabase-schema.ts` | 8 |  |  |
| `src/lib/supabase-server.ts` | 30 |  |  |
| `src/lib/supabase.ts` | 48 | setAppSessionToken:23, getAppSessionToken:27 |  |
| `src/lib/table-qr-url.ts` | 21 | tableQrParam:6, buildTableMenuUrl:18 |  |
| `src/lib/venue-cloud/mappers.ts` | 128 | ensureVirtualCategories:21, dbCategoriesForSave:45, restaurantRowToInfo:49, restaurantInfoToRow:66, productToRow:89, buildRestaurantData:106 |  |
| `src/lib/venue-cloud/sync.ts` | 230 | loadVenueBundle:19, saveVenueToCloud:49, postSaveVenueToCloud:126, queueSaveVenueToCloud:146, deleteVenueFromCloud:160, loadAllVenuesIntoStore:167, readLegacyLocalCms:205, ensureVenueLoaded:219 | API: /api/venue/save |
| `src/lib/waiter-session.ts` | 110 | sessionKey:20, readHistory:24, writeHistory:53, getWaiterSession:58, setWaiterSession:75, clearWaiterSession:87, getWaiterHistory:92, getLoginHistory:96, getLoginHistoryEntries:100, saveLoginToHistory:104 |  |
| `src/services/authService.ts` | 296 | checkLoginMode:33, signIn:48, inviteUser:88, generatePinResetOtp:112, resetPinWithOtp:127, signOut:138, pinSignIn:147, restoreSession:174, getCurrentUserProfile:190, getAllUsers:194, updateUserProfile:204, deleteUser:220, getUserRestaurantAccess:227, getRestaurantStaff:237, fetchAllUsersForAdmin:249, assignRestaurantRole:269, removeRestaurantAccess:287 | table: users; table: restaurant_access; API: /api/auth/login-mode; API: /api/auth/login; API: /api/admin/users/invite; API: /api/admin/users/pin-reset; API: /api/auth/reset-pin; API: /api/auth/logout; API: /api/waiter/pin-login; API: /api/auth/session |
| `src/services/happyHourService.ts` | 162 | normalizeTime:28, timeToMinutes:33, isTimeWithinSchedule:38, fetchSchedules:43, getHappyHourSchedules:73, getActiveHappyHourSchedules:77, saveHappyHourSchedule:81, deleteHappyHourSchedule:136, getActiveHappyHourPriceMap:144 | table: happy_hour_schedules; table: happy_hour_products |
| `src/services/inventoryService.ts` | 231 | getInventory:15, upsertInventoryItem:26, adjustInventory:56, deductTabFromInventory:115, getMovements:144, deleteInventoryItem:163, updateInventoryRow:168, setInventoryTracked:182 | table: inventory; table: inventory_movements; table: inventory_audit_log |
| `src/services/orderService.ts` | 174 | getOrders:17, getOrdersByStatus:28, createOrder:43, updateOrderStatus:73, deleteOrder:85, clearAllOrders:90, subscribeToOrders:103, getTodayOrderStats:153 | table: orders |
| `src/services/productService.ts` | 445 | isMissingOptionMetadataColumn:15, getCategories:29, upsertCategory:41, deleteCategory:53, reorderCategories:64, getProducts:83, getProductById:95, createProduct:107, updateProduct:119, deleteProduct:136, getAddons:144, syncAddons:155, getVariationsWithOptions:192, syncVariations:235, getFullProduct:309, getFullMenu:353 | table: categories; table: products; table: addons; table: variations; table: variation_options |
| `src/services/restaurantService.ts` | 249 | getAllRestaurants:16, getRestaurant:27, createRestaurant:40, updateRestaurant:55, deleteRestaurant:72, getPageContent:80, savePageContent:93, getComponentStyles:107, saveComponentStyles:123, getLayoutConfig:141, saveLayoutConfig:154, getThemeCustomizations:172, saveThemeCustomization:199, getFullVenueData:229 | table: restaurants; table: page_content; table: component_styles; table: layout_config; table: theme_customizations |
| `src/services/shiftService.ts` | 822 | normalizeTime:33, timeToInput:41, parseTimeToMinutes:45, combineDateAndTime:50, dateToDayOfWeek:57, getEligibleShiftStaff:63, loadSegmentAssignments:90, defaultDayHours:133, getWeeklySchedule:142, validateDaySchedule:206, saveDaySchedule:236, loadDateAssignmentsForSegments:305, assignmentsToIds:352, getDateRoster:356, replaceDateSegmentAssignments:413, saveDateRoster:452, getRosterHistory:482, getSegmentById:531, buildSegmentSummary:556 | table: restaurant_access; table: day_shift_segment_assignments; table: users; table: restaurant_day_hours; table: day_shift_segments; table: shift_date_assignments; table: shift_daily_roster; table: table_tabs; table: orders; table: tab_items; table: restaurant_tables |
| `src/services/tableService.ts` | 68 | getTables:6, getAllTables:18, createTable:29, updateTable:47, deleteTable:61 | table: restaurant_tables |
| `src/services/tabService.ts` | 446 | enrichTabs:35, attachItemsToTabs:62, recalcTabTotal:101, getOpenTabs:114, getClosedTabs:126, getOpenTabForTable:148, openTab:160, addItemToTab:183, activateTabItems:246, getBacklogForWaiter:264, removeItemFromTab:282, discardEmptyTab:288, discardStaleEmptyOpenTabs:309, closeTab:348, getTabWithItems:385, subscribeToTabs:412 | table: restaurant_tables; table: users; table: tab_items; table: table_tabs |
| `src/store/adminStore.ts` | 20 |  |  |
| `src/store/authStore.ts` | 144 | generateId:30 |  |
| `src/store/cartStore.ts` | 56 |  |  |
| `src/store/cmsStore.ts` | 4465 |  |  |
| `src/store/languageStore.ts` | 26 |  |  |
| `src/store/tableSessionStore.ts` | 48 |  |  |
| `src/types/auth.ts` | 53 |  |  |
| `src/types/cart.ts` | 31 |  |  |
| `src/types/cms.ts` | 433 |  |  |
| `src/types/order.ts` | 16 |  |  |
| `src/types/product.ts` | 59 |  |  |
| `src/types/shift.ts` | 187 |  |  |
| `src/types/supabase.ts` | 945 |  |  |

## Other tracked files

Every tracked file outside the typed-source index is listed here. Environment values are deliberately omitted.

| File | Role |
|---|---|
| `.env` | Runtime endpoint/schema/credentials and port; read privately, values omitted. |
| `.github/workflows/deploy.yml` | Production branch SSH deployment. |
| `.gitignore` | Ignored build/dependency/editor files. |
| `AGENTS.md` | Repository agent instructions. |
| `CMS_DOCUMENTATION.md` | Legacy documentation; see current inspection and tracker for corrections. |
| `DEFERER-PLAN.md` | Backlog/fired waiter-item feature plan and remaining work. |
| `MIGRATION_GUIDE.md` | Legacy documentation; see current inspection and tracker for corrections. |
| `PROJECT_DOCUMENTATION.md` | Legacy documentation; see current inspection and tracker for corrections. |
| `TRACKING_GUIDE.md` | Tracker process and documentation rules. |
| `build_output.txt` | Historical build output; not current verification. |
| `complete-theme-content.mjs` | CMS theme content rewrite utility. |
| `next.config.js` | Next build/runtime configuration. |
| `package-lock.json` | npm dependency lock; used for this local verification. |
| `package.json` | Dependencies and npm scripts. |
| `pm2.config.js` | Production process/port/memory configuration. |
| `pnpm-lock.yaml` | pnpm dependency lock; used by production deployment. |
| `postcss.config.js` | CSS build plugins. |
| `public/icons/icon.svg` | PWA vector icon. |
| `public/manifest.json` | Admin PWA manifest. |
| `public/sw.js` | Admin service worker/cache behavior. |
| `scripts/deferer-tab-items-fire-status.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `scripts/happy-hour-and-inventory-tracking-rls.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `scripts/happy-hour-and-inventory-tracking.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `scripts/migrate-admin-tokens.mjs` | Admin style-token source rewrite utility. |
| `scripts/sarayamenu-option-metadata.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `scripts/shift-date-roster.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `scripts/shift-weekly-schedule.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `scripts/shifts.sql` | Manual incremental schema/policy SQL; not a complete database bootstrap. |
| `src/app/icon.png` | App raster icon. |
| `src/styles/globals.css` | Global styling, theme selectors and utility classes. |
| `tailwind.config.js` | Theme/CSS generation configuration. |
| `tracking.db` | SQLite living technical memory. |
| `tsconfig.json` | TypeScript compiler and import aliases. |
| `update-themes.mjs` | CMS theme source rewrite utility. |

## Reachability notes

`AdminPWA` is loaded dynamically by the admin layout. Static import reachability alone would miss it. `DataStorageNotice`, `WaiterPicker`, `QuantitySelector`, and `useWaiterIdleTimeout` have no current import consumers. Legacy admin editor routes remain routable even without navigation links.

The architectural report explains runtime dependencies; this index should be regenerated after substantial source changes.
