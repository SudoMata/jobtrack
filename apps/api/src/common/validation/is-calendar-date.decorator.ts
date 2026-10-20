import { registerDecorator } from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';
import { isCalendarDate } from '../dates/calendar-date';

/** The value must be a real calendar date written `YYYY-MM-DD`. */
export function IsCalendarDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isCalendarDate(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid date in the format YYYY-MM-DD`,
      },
    });
  };
}
