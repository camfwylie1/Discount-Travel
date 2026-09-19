-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'CONNECTIONS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TravelPace" AS ENUM ('VERY_RELAXED', 'RELAXED', 'BALANCED', 'ACTIVE', 'PACKED');

-- CreateEnum
CREATE TYPE "DimensionCategory" AS ENUM ('TRAVEL_STYLE', 'ACTIVITY', 'FOOD_DRINK', 'CULTURE', 'SOCIAL', 'ACCOMMODATION', 'SPECTRUM');

-- CreateEnum
CREATE TYPE "DimensionKind" AS ENUM ('RATING', 'SPECTRUM');

-- CreateEnum
CREATE TYPE "DestinationKind" AS ENUM ('CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'AREA');

-- CreateEnum
CREATE TYPE "WishlistKind" AS ENUM ('COUNTRY', 'CITY', 'EXPERIENCE');

-- CreateEnum
CREATE TYPE "IngestionMethod" AS ENUM ('API', 'AFFILIATE_FEED', 'CSV_UPLOAD', 'JSON_IMPORT', 'XML_FEED', 'MANUAL_ENTRY', 'STRUCTURED_EXTRACTION');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('NOT_REVIEWED', 'UNDER_REVIEW', 'PERMITTED', 'PERMITTED_WITH_CONDITIONS', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('DRAFT', 'ACTIVE', 'POSSIBLY_EXPIRED', 'EXPIRED', 'SOLD_OUT', 'UNKNOWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DateFlexibility" AS ENUM ('FIXED', 'FLEXIBLE_3', 'FLEXIBLE_7', 'MULTIPLE_DEPARTURES', 'ANYTIME', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "PhysicalDifficulty" AS ENUM ('EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "DuplicateVerdict" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED');

-- CreateEnum
CREATE TYPE "SavedState" AS ENUM ('SAVED', 'INTERESTED', 'PLANNING', 'BOOKED', 'PAST', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "ShareTarget" AS ENUM ('USER', 'CIRCLE', 'TRIP', 'LINK');

-- CreateEnum
CREATE TYPE "ShareResponse" AS ENUM ('NONE', 'INTERESTED', 'MAYBE', 'NOT_FOR_ME');

-- CreateEnum
CREATE TYPE "RecEventType" AS ENUM ('IMPRESSION', 'CLICK', 'SAVE', 'SHARE', 'HIDE', 'VIEW_PROVIDER', 'INVITE_FRIEND', 'JOIN_TRIP', 'NOT_INTERESTED', 'FEEDBACK_YES', 'FEEDBACK_NO');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('IDEA', 'PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripMemberState" AS ENUM ('INVITED', 'INTERESTED', 'CONFIRMED', 'DECLINED', 'LEFT');

-- CreateEnum
CREATE TYPE "VoteKind" AS ENUM ('DATE_WINDOW', 'AIRPORT', 'DEAL');

-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'CIRCLE', 'TRIP');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('USER', 'MESSAGE', 'DEAL', 'PHOTO', 'TRIP');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('DEAL_SHARED', 'CONNECTION_REQUEST', 'CONNECTION_ACCEPTED', 'TRIP_INVITE', 'TRIP_JOINED', 'NEW_MESSAGE', 'NEW_MATCH', 'PRICE_CHANGED', 'DEAL_EXPIRING', 'CIRCLE_ACTIVITY', 'SUBSCRIPTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY_FOR_REVIEW', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMP(3),
    "ageConfirmed18" BOOLEAN NOT NULL DEFAULT false,
    "ageConfirmedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastInitial" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "aiBio" TEXT,
    "aiBioEditedAt" TIMESTAMP(3),
    "photoUrl" TEXT,
    "photoThumbUrl" TEXT,
    "photoStatus" TEXT NOT NULL DEFAULT 'NONE',
    "homeCity" TEXT,
    "homeRegion" TEXT,
    "homeCountry" TEXT NOT NULL DEFAULT 'CA',
    "ageRange" TEXT,
    "exactAge" INTEGER,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countriesVisited" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "travelPace" "TravelPace" NOT NULL DEFAULT 'BALANCED',
    "favouriteTrip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileVisibility" "Visibility" NOT NULL DEFAULT 'CONNECTIONS',
    "photoVisibility" "Visibility" NOT NULL DEFAULT 'CONNECTIONS',
    "ageVisibility" "Visibility" NOT NULL DEFAULT 'CONNECTIONS',
    "cityVisibility" "Visibility" NOT NULL DEFAULT 'CONNECTIONS',
    "wishlistVisibility" "Visibility" NOT NULL DEFAULT 'CONNECTIONS',
    "savedDealsVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "upcomingTripVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "discoverable" BOOLEAN NOT NULL DEFAULT true,
    "indexableBySearchEngines" BOOLEAN NOT NULL DEFAULT false,
    "whoCanMessage" TEXT NOT NULL DEFAULT 'CONNECTIONS',
    "whoCanInviteToTrips" TEXT NOT NULL DEFAULT 'CONNECTIONS',
    "showsAgeRangePreference" BOOLEAN NOT NULL DEFAULT false,
    "preferredAgeMin" INTEGER,
    "preferredAgeMax" INTEGER,
    "optInWomenOnlySpaces" BOOLEAN NOT NULL DEFAULT false,
    "optInLgbtqSpaces" BOOLEAN NOT NULL DEFAULT false,
    "optInSoloTravellers" BOOLEAN NOT NULL DEFAULT false,
    "consentAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "consentPersonalisation" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceDimension" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" "DimensionCategory" NOT NULL,
    "kind" "DimensionKind" NOT NULL DEFAULT 'RATING',
    "poleLowLabel" TEXT,
    "poleHighLabel" TEXT,
    "engineWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "radarAxis" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreferenceDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "rating" INTEGER,
    "spectrum" INTEGER,
    "peopleWeight" INTEGER NOT NULL DEFAULT 3,
    "source" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioQuestion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScenarioQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sublabel" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScenarioOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioEffect" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScenarioEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelConstraint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetMax" INTEGER,
    "budgetPreferred" INTEGER,
    "budgetMin" INTEGER,
    "budgetCurrency" TEXT NOT NULL DEFAULT 'CAD',
    "budgetIsPerPerson" BOOLEAN NOT NULL DEFAULT true,
    "budgetMaxIsHard" BOOLEAN NOT NULL DEFAULT true,
    "budgetIncludesAirfare" BOOLEAN NOT NULL DEFAULT true,
    "earliestDeparture" TIMESTAMP(3),
    "latestReturn" TIMESTAMP(3),
    "datesAreHard" BOOLEAN NOT NULL DEFAULT false,
    "dateFlexibilityDays" INTEGER NOT NULL DEFAULT 7,
    "blackoutNote" TEXT,
    "preferredMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "weekendsOnly" BOOLEAN NOT NULL DEFAULT false,
    "durationMin" INTEGER,
    "durationMax" INTEGER,
    "durationPreferred" INTEGER,
    "durationIsHard" BOOLEAN NOT NULL DEFAULT false,
    "airportsAreHard" BOOLEAN NOT NULL DEFAULT false,
    "includeNearbyAirports" BOOLEAN NOT NULL DEFAULT true,
    "nearbyRadiusKm" INTEGER NOT NULL DEFAULT 200,
    "maxFlightHours" INTEGER,
    "requiresDirectFlight" BOOLEAN NOT NULL DEFAULT false,
    "avoidTripTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessibilityNotes" TEXT,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "icao" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "continent" TEXT NOT NULL DEFAULT 'North America',
    "timezone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isGateway" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAirport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "temporaryUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAirport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DestinationKind" NOT NULL,
    "parentId" TEXT,
    "country" TEXT,
    "countryName" TEXT,
    "continent" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "heroImageUrl" TEXT,
    "blurb" TEXT,
    "traits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WishlistKind" NOT NULL,
    "label" TEXT NOT NULL,
    "destinationId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "countryScope" TEXT[] DEFAULT ARRAY['CA']::TEXT[],
    "currencies" TEXT[] DEFAULT ARRAY['CAD']::TEXT[],
    "tripTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualityScore" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sponsored" BOOLEAN NOT NULL DEFAULT false,
    "sponsoredUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCompliance" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "hasPublicApi" BOOLEAN NOT NULL DEFAULT false,
    "apiDocsUrl" TEXT,
    "apiCredentialEnvKey" TEXT,
    "hasAffiliateProgram" BOOLEAN NOT NULL DEFAULT false,
    "affiliateNetwork" TEXT,
    "affiliateId" TEXT,
    "affiliateFeedUrl" TEXT,
    "commissionModel" TEXT,
    "commissionNotes" TEXT,
    "structuredExtractionPermitted" BOOLEAN NOT NULL DEFAULT false,
    "termsUrl" TEXT,
    "termsReviewedAt" TIMESTAMP(3),
    "termsReviewedBy" TEXT,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT true,
    "attributionText" TEXT,
    "cachingRestrictions" TEXT,
    "maxCacheHours" INTEGER,
    "imageUseRestricted" BOOLEAN NOT NULL DEFAULT true,
    "imageUseNotes" TEXT,
    "referralRules" TEXT,
    "allowedMethods" "IngestionMethod"[] DEFAULT ARRAY[]::"IngestionMethod"[],
    "updateFrequencyHours" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "blockedReason" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "affiliateUrl" TEXT,
    "sourceReference" TEXT,
    "sourceAttribution" TEXT,
    "ingestionMethod" "IngestionMethod" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "originalTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "originalDescription" TEXT,
    "aiSummary" TEXT,
    "aiSummaryModel" TEXT,
    "aiSummaryAt" TIMESTAMP(3),
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destinationCountry" TEXT,
    "destinationRegion" TEXT,
    "destinationCity" TEXT,
    "continent" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "departureAirportId" TEXT,
    "arrivalAirportId" TEXT,
    "departureDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "dateFlexibility" "DateFlexibility" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "durationNights" INTEGER,
    "durationDays" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "salePriceCents" INTEGER,
    "regularPriceCents" INTEGER,
    "discountCents" INTEGER,
    "discountPercent" DOUBLE PRECISION,
    "pricePerPerson" BOOLEAN NOT NULL DEFAULT true,
    "singleSupplementCents" INTEGER,
    "taxesIncluded" BOOLEAN,
    "feesIncluded" BOOLEAN,
    "airfareIncluded" BOOLEAN,
    "accommodationIncluded" BOOLEAN,
    "mealsIncluded" BOOLEAN,
    "mealsDescription" TEXT,
    "activitiesIncluded" BOOLEAN,
    "transportIncluded" BOOLEAN,
    "guideIncluded" BOOLEAN,
    "accommodationType" TEXT,
    "accommodationQuality" INTEGER,
    "groupSizeMin" INTEGER,
    "groupSizeMax" INTEGER,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "physicalDifficulty" "PhysicalDifficulty" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "activityLevel" INTEGER,
    "tripStyle" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "soloFriendly" BOOLEAN,
    "cancellationPolicy" TEXT,
    "importantInfo" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
    "bookingDeadline" TIMESTAMP(3),
    "spotsRemaining" INTEGER,
    "availabilityNote" TEXT,
    "sourceLastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "confidence" JSONB,
    "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "qualityIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerMetadata" JSONB,
    "valueScore" DOUBLE PRECISION,
    "valueComponents" JSONB,
    "valueComputedAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredRank" INTEGER,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealImage" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "credit" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHero" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DealImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAttribute" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" TEXT NOT NULL DEFAULT 'RULE',
    "evidence" TEXT,

    CONSTRAINT "DealAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealInclusion" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DealInclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealDestination" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DealDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealDeparture" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "airportIata" TEXT,
    "priceCents" INTEGER,
    "spotsRemaining" INTEGER,

    CONSTRAINT "DealDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealPriceHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'INGESTION',

    CONSTRAINT "DealPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'THEME',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealTagLink" (
    "dealId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "DealTagLink_pkey" PRIMARY KEY ("dealId","tagId")
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL,
    "dealAId" TEXT NOT NULL,
    "dealBId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "verdict" "DuplicateVerdict" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedDeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "state" "SavedState" NOT NULL DEFAULT 'SAVED',
    "note" TEXT,
    "selfReportedBooking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealShare" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "target" "ShareTarget" NOT NULL,
    "recipientId" TEXT,
    "circleId" TEXT,
    "tripId" TEXT,
    "conversationId" TEXT,
    "message" TEXT,
    "response" "ShareResponse" NOT NULL DEFAULT 'NONE',
    "respondedAt" TIMESTAMP(3),
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealClick" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT,
    "outboundUrl" TEXT NOT NULL,
    "referralSource" TEXT,
    "campaign" TEXT,
    "placement" TEXT,
    "matchScore" DOUBLE PRECISION,
    "sessionHint" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "helpful" BOOLEAN,
    "reason" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "mismatches" JSONB NOT NULL,
    "hardFiltered" BOOLEAN NOT NULL DEFAULT false,
    "filterReason" TEXT,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelerMatch" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "shared" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT,
    "type" "RecEventType" NOT NULL,
    "placement" TEXT,
    "position" INTEGER,
    "score" DOUBLE PRECISION,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colour" TEXT NOT NULL DEFAULT 'terracotta',
    "emojiFree" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMember" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripGroup" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dealId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'IDEA',
    "targetStart" TIMESTAMP(3),
    "targetEnd" TIMESTAMP(3),
    "budgetMaxCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "maxMembers" INTEGER,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripMember" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "TripMemberState" NOT NULL DEFAULT 'INVITED',
    "isOrganiser" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripVote" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "VoteKind" NOT NULL,
    "optionKey" TEXT NOT NULL,
    "airportId" TEXT,
    "value" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "title" TEXT,
    "circleId" TEXT,
    "tripId" TEXT,
    "directKey" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "leftAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment" JSONB,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "moderationFlag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "reportedUserId" TEXT,
    "messageId" TEXT,
    "dealId" TEXT,
    "tripId" TEXT,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolverId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "interval" TEXT NOT NULL DEFAULT 'year',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "lastPaymentFailedAt" TIMESTAMP(3),
    "lastPaymentFailureReason" TEXT,
    "promoCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeInvoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "failureReason" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "trialDays" INTEGER,
    "stripeCouponId" TEXT,
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referredUserId" TEXT,
    "invitedEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "rewardNote" TEXT,
    "signedUpAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "actorId" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "uploadedById" TEXT,
    "filename" TEXT,
    "method" "IngestionMethod" NOT NULL,
    "format" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "complianceNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "normalized" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "warnings" JSONB,
    "duplicateOfId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "name" TEXT NOT NULL,
    "properties" JSONB,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "output" JSONB NOT NULL,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TravelPersonality" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tripStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destinationIdeas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idealCompanions" TEXT,
    "radar" JSONB NOT NULL,
    "archetypeKey" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'fallback',
    "model" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPersonality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "OAuthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_idx" ON "VerificationToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_homeCountry_idx" ON "Profile"("homeCountry");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacySetting_userId_key" ON "PrivacySetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceDimension_key_key" ON "PreferenceDimension"("key");

-- CreateIndex
CREATE INDEX "PreferenceDimension_category_sortOrder_idx" ON "PreferenceDimension"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "PreferenceDimension_active_idx" ON "PreferenceDimension"("active");

-- CreateIndex
CREATE INDEX "UserPreference_dimensionId_idx" ON "UserPreference"("dimensionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_dimensionId_key" ON "UserPreference"("userId", "dimensionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioQuestion_key_key" ON "ScenarioQuestion"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioOption_questionId_key_key" ON "ScenarioOption"("questionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioEffect_optionId_dimensionId_key" ON "ScenarioEffect"("optionId", "dimensionId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelConstraint_userId_key" ON "TravelConstraint"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_iata_key" ON "Airport"("iata");

-- CreateIndex
CREATE INDEX "Airport_country_isActive_idx" ON "Airport"("country", "isActive");

-- CreateIndex
CREATE INDEX "Airport_city_idx" ON "Airport"("city");

-- CreateIndex
CREATE INDEX "UserAirport_airportId_idx" ON "UserAirport"("airportId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAirport_userId_airportId_key" ON "UserAirport"("userId", "airportId");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Destination_kind_active_idx" ON "Destination"("kind", "active");

-- CreateIndex
CREATE INDEX "Destination_parentId_idx" ON "Destination"("parentId");

-- CreateIndex
CREATE INDEX "Destination_country_idx" ON "Destination"("country");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_destinationId_idx" ON "WishlistItem"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE INDEX "Provider_active_idx" ON "Provider"("active");

-- CreateIndex
CREATE INDEX "Provider_slug_idx" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCompliance_providerId_key" ON "ProviderCompliance"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_slug_key" ON "Deal"("slug");

-- CreateIndex
CREATE INDEX "Deal_status_expiresAt_idx" ON "Deal"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Deal_providerId_idx" ON "Deal"("providerId");

-- CreateIndex
CREATE INDEX "Deal_departureAirportId_status_idx" ON "Deal"("departureAirportId", "status");

-- CreateIndex
CREATE INDEX "Deal_destinationCountry_idx" ON "Deal"("destinationCountry");

-- CreateIndex
CREATE INDEX "Deal_salePriceCents_idx" ON "Deal"("salePriceCents");

-- CreateIndex
CREATE INDEX "Deal_departureDate_idx" ON "Deal"("departureDate");

-- CreateIndex
CREATE INDEX "Deal_durationNights_idx" ON "Deal"("durationNights");

-- CreateIndex
CREATE INDEX "Deal_featured_featuredRank_idx" ON "Deal"("featured", "featuredRank");

-- CreateIndex
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");

-- CreateIndex
CREATE INDEX "Deal_status_salePriceCents_departureDate_idx" ON "Deal"("status", "salePriceCents", "departureDate");

-- CreateIndex
CREATE INDEX "DealImage_dealId_sortOrder_idx" ON "DealImage"("dealId", "sortOrder");

-- CreateIndex
CREATE INDEX "DealAttribute_dimensionId_intensity_idx" ON "DealAttribute"("dimensionId", "intensity");

-- CreateIndex
CREATE UNIQUE INDEX "DealAttribute_dealId_dimensionId_key" ON "DealAttribute"("dealId", "dimensionId");

-- CreateIndex
CREATE INDEX "DealInclusion_dealId_kind_idx" ON "DealInclusion"("dealId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryDay_dealId_dayNumber_key" ON "ItineraryDay"("dealId", "dayNumber");

-- CreateIndex
CREATE INDEX "DealDestination_destinationId_idx" ON "DealDestination"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "DealDestination_dealId_destinationId_key" ON "DealDestination"("dealId", "destinationId");

-- CreateIndex
CREATE INDEX "DealDeparture_dealId_departureDate_idx" ON "DealDeparture"("dealId", "departureDate");

-- CreateIndex
CREATE INDEX "DealDeparture_departureDate_idx" ON "DealDeparture"("departureDate");

-- CreateIndex
CREATE INDEX "DealPriceHistory_dealId_observedAt_idx" ON "DealPriceHistory"("dealId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "DealTagLink_tagId_idx" ON "DealTagLink"("tagId");

-- CreateIndex
CREATE INDEX "DuplicateCandidate_verdict_score_idx" ON "DuplicateCandidate"("verdict", "score");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateCandidate_dealAId_dealBId_key" ON "DuplicateCandidate"("dealAId", "dealBId");

-- CreateIndex
CREATE INDEX "SavedDeal_dealId_state_idx" ON "SavedDeal"("dealId", "state");

-- CreateIndex
CREATE INDEX "SavedDeal_userId_state_idx" ON "SavedDeal"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SavedDeal_userId_dealId_key" ON "SavedDeal"("userId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealShare_shareToken_key" ON "DealShare"("shareToken");

-- CreateIndex
CREATE INDEX "DealShare_recipientId_createdAt_idx" ON "DealShare"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "DealShare_dealId_idx" ON "DealShare"("dealId");

-- CreateIndex
CREATE INDEX "DealShare_circleId_idx" ON "DealShare"("circleId");

-- CreateIndex
CREATE INDEX "DealShare_tripId_idx" ON "DealShare"("tripId");

-- CreateIndex
CREATE INDEX "DealClick_dealId_createdAt_idx" ON "DealClick"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DealClick_providerId_createdAt_idx" ON "DealClick"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "DealClick_userId_createdAt_idx" ON "DealClick"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DealFeedback_dealId_reason_idx" ON "DealFeedback"("dealId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "DealFeedback_userId_dealId_key" ON "DealFeedback"("userId", "dealId");

-- CreateIndex
CREATE INDEX "MatchScore_userId_score_idx" ON "MatchScore"("userId", "score");

-- CreateIndex
CREATE INDEX "MatchScore_dealId_idx" ON "MatchScore"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScore_userId_dealId_key" ON "MatchScore"("userId", "dealId");

-- CreateIndex
CREATE INDEX "TravelerMatch_userAId_score_idx" ON "TravelerMatch"("userAId", "score");

-- CreateIndex
CREATE INDEX "TravelerMatch_userBId_score_idx" ON "TravelerMatch"("userBId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "TravelerMatch_userAId_userBId_key" ON "TravelerMatch"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "RecommendationEvent_userId_type_createdAt_idx" ON "RecommendationEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_dealId_type_idx" ON "RecommendationEvent"("dealId", "type");

-- CreateIndex
CREATE INDEX "Connection_addresseeId_status_idx" ON "Connection"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Connection_requesterId_status_idx" ON "Connection"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_requesterId_addresseeId_key" ON "Connection"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "Circle_ownerId_idx" ON "Circle"("ownerId");

-- CreateIndex
CREATE INDEX "CircleMember_userId_idx" ON "CircleMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleMember_circleId_userId_key" ON "CircleMember"("circleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripGroup_inviteToken_key" ON "TripGroup"("inviteToken");

-- CreateIndex
CREATE INDEX "TripGroup_ownerId_idx" ON "TripGroup"("ownerId");

-- CreateIndex
CREATE INDEX "TripGroup_dealId_idx" ON "TripGroup"("dealId");

-- CreateIndex
CREATE INDEX "TripGroup_status_idx" ON "TripGroup"("status");

-- CreateIndex
CREATE INDEX "TripMember_userId_state_idx" ON "TripMember"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "TripMember_tripId_userId_key" ON "TripMember"("tripId", "userId");

-- CreateIndex
CREATE INDEX "TripVote_tripId_kind_idx" ON "TripVote"("tripId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TripVote_tripId_userId_kind_optionKey_key" ON "TripVote"("tripId", "userId", "kind", "optionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_circleId_key" ON "Conversation"("circleId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tripId_key" ON "Conversation"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRead_messageId_userId_key" ON "MessageRead"("messageId", "userId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "Payment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_providerId_idx" ON "ImportBatch"("providerId");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImportLog_batchId_createdAt_idx" ON "ImportLog"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiGeneration_capability_createdAt_idx" ON "AiGeneration"("capability", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiGeneration_capability_inputHash_key" ON "AiGeneration"("capability", "inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "TravelPersonality_userId_key" ON "TravelPersonality"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacySetting" ADD CONSTRAINT "PrivacySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "PreferenceDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioOption" ADD CONSTRAINT "ScenarioOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ScenarioQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ScenarioOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "PreferenceDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelConstraint" ADD CONSTRAINT "TravelConstraint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAirport" ADD CONSTRAINT "UserAirport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAirport" ADD CONSTRAINT "UserAirport_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Destination" ADD CONSTRAINT "Destination_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCompliance" ADD CONSTRAINT "ProviderCompliance_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealImage" ADD CONSTRAINT "DealImage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAttribute" ADD CONSTRAINT "DealAttribute_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAttribute" ADD CONSTRAINT "DealAttribute_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "PreferenceDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInclusion" ADD CONSTRAINT "DealInclusion_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDestination" ADD CONSTRAINT "DealDestination_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDestination" ADD CONSTRAINT "DealDestination_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDeparture" ADD CONSTRAINT "DealDeparture_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealPriceHistory" ADD CONSTRAINT "DealPriceHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealTagLink" ADD CONSTRAINT "DealTagLink_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealTagLink" ADD CONSTRAINT "DealTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_dealAId_fkey" FOREIGN KEY ("dealAId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_dealBId_fkey" FOREIGN KEY ("dealBId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDeal" ADD CONSTRAINT "SavedDeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDeal" ADD CONSTRAINT "SavedDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealClick" ADD CONSTRAINT "DealClick_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealClick" ADD CONSTRAINT "DealClick_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealClick" ADD CONSTRAINT "DealClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScore" ADD CONSTRAINT "MatchScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScore" ADD CONSTRAINT "MatchScore_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelerMatch" ADD CONSTRAINT "TravelerMatch_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelerMatch" ADD CONSTRAINT "TravelerMatch_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripGroup" ADD CONSTRAINT "TripGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripGroup" ADD CONSTRAINT "TripGroup_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripVote" ADD CONSTRAINT "TripVote_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripVote" ADD CONSTRAINT "TripVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripVote" ADD CONSTRAINT "TripVote_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPersonality" ADD CONSTRAINT "TravelPersonality_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
