import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { authLimiter } from '../../middleware/rateLimiter';
import { loginSchema, changePasswordSchema } from './auth.validation';

const router = Router();

router.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  authController.login
);

router.post('/refresh', authLimiter, authController.refresh);

router.post('/logout', authenticate, authController.logout);

router.post(
  '/change-password',
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  authController.changePassword
);

router.get('/me', authenticate, authController.getMe);

export default router;
