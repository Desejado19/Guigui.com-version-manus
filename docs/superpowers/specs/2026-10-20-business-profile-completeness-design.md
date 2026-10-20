# Business Profile Completeness and Presentation

**Status:** Revised design; awaiting user review
**Date:** 2026-10-20

## Goal

Make every business profile more complete, clear, and professional across
registration, business management, directory cards, and the public profile,
without inventing business information or requiring fields that do not apply
to every type of business.

## User-approved scope

- Collect essential profile information when registering a business.
- Let a business complete and update its profile through its management
  dashboard.
- Show profile completeness and outstanding fields without hiding existing
  businesses that have incomplete data.
- Preserve and hydrate data already stored by the server instead of replacing
  it with empty defaults.
- Improve directory cards and public profiles, including graceful fallbacks
  for absent or broken images.
- Let administrators manually choose and order businesses for the homepage
  featured carousel.
- Show administratively selected businesses before active advertising
  campaigns in the shared homepage rotation; do not remove or disable active
  campaigns.
- Keep existing business approval state unchanged during profile edits.
- Protect business profile writes so a business account can change only its
  own profile. Administrative ownership, approval, and moderation fields
  cannot be changed through that profile-edit flow.
- Keep account email private unless the business explicitly provides a
  separate public contact email.
- Do not fabricate data or add a database migration in this scope.

## Profile data requirements

The following fields are required for a complete business profile:

- Business name.
- Main category and subcategory.
- A meaningful business description.
- Public contact phone number.
- Neighborhood.

The following fields are optional or applicable only when the business has
them:

- Exact address and opening hours.
- Public email, WhatsApp, website, and social links.
- Service languages.
- Logo, cover image, and gallery.
- Products, features, posts, and promotions.

Optional fields must not be represented as real values when missing. A
business may mark a field as not applicable where the dashboard offers that
choice; the profile must still distinguish missing information from
information that does not apply.

## Registration and management

The business registration flow collects the essential profile fields before
creating a business account. Existing plan selection and payment steps remain
unchanged.

The business dashboard includes a profile-completion section with:

- A completion indicator and a concise list of required or recommended
  information that is still missing.
- Editable profile fields, including optional contact and presentation
  information.
- A save action with an explicit success or failure outcome.
- No forced change to the business approval, subscription, or moderation
  state.

Existing businesses remain visible and usable while incomplete. They can
complete their profiles later; the system does not generate substitute
addresses, contacts, schedules, or descriptions.

## Persistence and authorization

The existing business persistence contract remains in use. The public
business-list response already returns stored business data; the client must
hydrate those values and apply defaults only for fields actually absent.

Business profile writes must:

1. Require an authenticated business or administrator session.
2. Resolve a business user's permitted business ID from the authenticated
   server-side user record.
3. Reject attempts by a business user to target another business.
4. Validate profile field types and required fields at the write boundary.
5. Preserve server-owned fields such as owner, approval status, verification,
   moderation status, and creation metadata when updating the profile.
6. Persist the update through the existing PostgreSQL business adapter and
   return an explicit error when persistence fails.

This scope does not redesign JSON-mode business persistence or add schema
migrations. If inspection shows that the current store cannot persist a
required edit safely in the supported runtime, stop and document the needed
decision rather than claiming a successful save.

## Directory card

The card prioritizes business name, category/subcategory, neighborhood, a
short description, and available contact actions. Rating/review information
is presented only when there are reviews; empty ratings must not look like
earned scores.

Missing or broken cover images use a consistent local visual fallback.
Missing or broken logos use a branded initials fallback based on the business
name. Image failures must not collapse the card layout or block its actions.

## Public business profile

Group present information into clear sections:

- About.
- Contact and location.
- Opening hours.
- Services and products.
- Social links and media gallery when present.

Omit empty values rather than displaying blank labels or fabricated
placeholders. Preserve existing follow, message, review, post, promotion,
navigation, and contact-metric behavior.

The layout remains responsive and accessible, including meaningful image
fallback text, keyboard-operable actions, and readable content at narrow
viewport widths.

## Homepage featured businesses and advertising

The homepage banner currently displays active advertising campaigns. Extend
the same rotating presentation so it can also show businesses selected and
ordered manually by an administrator.

- Only businesses with active status may be selected for the public featured
  rotation. Suspended, rejected, or pending businesses are not eligible for
  display.
- The administrator controls membership and ordering. The carousel must not
  silently add businesses based only on subscription tier or an existing
  featured flag.
- On the public homepage, selected businesses appear before active advertising
  campaigns. Active campaigns remain eligible and continue to rotate after
  the selected businesses; this change does not replace campaign display.
- A business slide links to that business's public profile and identifies it
  as a featured business, not as a paid campaign.
- If there are no manually selected businesses, keep showing active campaigns
  as before. If neither selected businesses nor active campaigns exist, omit
  the banner region.
- The administration interface must allow an authorized administrator to
  select eligible businesses, change their order, and remove them from the
  featured rotation. Changes must be persisted and reflected publicly without
  altering a business's approval or subscription state.

The exact persistence adapter and administrative interaction should follow
the existing project patterns during planning; avoid a database migration
unless code inspection proves the current persistence boundary cannot support
the required behavior safely.

## Error handling and privacy

- Invalid essential fields return field-level validation errors.
- Unauthorized cross-business writes return an authorization error and do not
  mutate persisted data.
- Persistence failures are shown to the user as save failures; they must not
  be reported as success.
- Existing private account email remains private unless a separate public
  business email is explicitly supplied.
- Do not include private account information in public directory responses or
  image fallback URLs.

## Verification

- Unit tests cover required-field validation, profile completion calculation,
  and missing versus not-applicable optional fields.
- API tests cover profile persistence, authenticated ownership checks, admin
  behavior, preservation of server-owned fields, and failure responses.
- Client tests verify stored company data is hydrated rather than replaced by
  empty defaults.
- Component tests verify card and profile rendering for complete and
  incomplete businesses, zero reviews, and broken/missing image fallbacks.
- Tests verify that only active businesses are eligible for the manually
  curated homepage list, that administrator ordering is preserved, and that
  selected businesses precede active ad campaigns without suppressing them.
- Authorization and persistence tests cover management of the featured list;
  business accounts cannot change the administrator-curated selection.
- Playwright verifies profile completion/edit/save behavior and responsive
  directory/profile and homepage carousel layout.
- Run the relevant unit and Playwright tests, `npm run check`,
  `npm run test:i18n`, and `npm run build`.

## Out of scope

- Inventing or bulk-filling real-world business details.
- Hiding or suspending existing businesses because their profiles are
  incomplete.
- Requiring exact addresses, opening hours, public emails, websites, social
  accounts, or images.
- Changing pricing, subscriptions, payments, approval rules, or business
  moderation.
- Building a new media-storage or image-upload service.
- Database schema migrations, redesign of the JSON persistence system, or
  external provider integrations.
