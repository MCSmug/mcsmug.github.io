/**
 * Who operates this installation of the app. Shown in the legal notice and the
 * privacy policy. Leave `name` empty while the app is not handed to anyone else:
 * the pages then say that the details are still missing.
 */
export const OPERATOR = {
  name: '',
  street: '',
  city: '',
  email: '',
}

export const hasOperator = OPERATOR.name.trim() !== ''
