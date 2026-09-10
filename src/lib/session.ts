import { cache } from 'react';
import { headers } from 'next/headers';

import { auth } from '@/lib/auth';

/**
 * Session lookup for Server Components. React.cache memoizes it for the
 * current request so the authenticated layout and the page share one
 * validation. It does not survive to the next request. Server actions still
 * call auth.api.getSession themselves; they are a different request.
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));
