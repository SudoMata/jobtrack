import { registerDecorator } from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';
import { isCalendarDate, latestCalendarDateOnEarth } from '../dates/calendar-date';

/**
 * The date must not be in the future (anywhere on Earth).
 * A value that is not a calendar date is left to `IsCalendarDate`, so that
 * a single mistake does not produce two error messages.
 */
export function IsNotFutureDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate: (value: unknown) =>
          !isCalendarDate(value) || value <= latestCalendarDateOnEarth(),
        defaultMessage: (args: ValidationArguments) => `${args.property} must not be in the future`,
      },
    });
  };
}
