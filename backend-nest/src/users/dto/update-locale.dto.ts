import { IsIn, IsNotEmpty } from 'class-validator';
import { SUPPORTED_LOCALES, SupportedLocale } from './update-user.dto';

/**
 * Update Locale DTO
 *
 * Validates payload for updating the current user's locale preference.
 */
export class UpdateLocaleDto {
  @IsNotEmpty({ message: 'Locale is required' })
  @IsIn([...SUPPORTED_LOCALES], {
    message: `Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
  })
  locale: SupportedLocale;
}
