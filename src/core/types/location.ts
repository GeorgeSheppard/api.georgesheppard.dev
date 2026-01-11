export enum Location {
  Us = 'Us',
  Gb = 'Gb',
  De = 'De',
  Fr = 'Fr',
  It = 'It',
  Au = 'Au',
  Es = 'Es',
}

export function toAffiliateTag(location: Location): string {
  switch (location) {
    case Location.Us:
      return 'shelfie0e-20';
    case Location.Gb:
      return 'shelfie02-21';
    case Location.De:
      return 'shelfie0f-21';
    case Location.Fr:
      return 'shelfie06-21';
    case Location.It:
      return 'shelfie0d-21';
    case Location.Au:
      return 'shelfie0a-22';
    case Location.Es:
      return 'shelfie08-21';
    default:
      return 'shelfie0e-20'; // Default to US
  }
}

export function toCountryName(location: Location): string {
  switch (location) {
    case Location.Us:
      return 'United States';
    case Location.Gb:
      return 'United Kingdom';
    case Location.De:
      return 'Germany';
    case Location.Fr:
      return 'France';
    case Location.It:
      return 'Italy';
    case Location.Au:
      return 'Australia';
    case Location.Es:
      return 'Spain';
    default:
      return 'United States';
  }
}

export function toAmazonDomain(location: Location): string {
  switch (location) {
    case Location.Us:
      return 'amazon.com';
    case Location.Gb:
      return 'amazon.co.uk';
    case Location.De:
      return 'amazon.de';
    case Location.Fr:
      return 'amazon.fr';
    case Location.It:
      return 'amazon.it';
    case Location.Au:
      return 'amazon.com.au';
    case Location.Es:
      return 'amazon.es';
    default:
      return 'amazon.com';
  }
}
