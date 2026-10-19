-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'location_admin', 'member');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'team', 'business', 'enterprise');

-- CreateEnum
CREATE TYPE "CampaignMode" AS ENUM ('onsite', 'shipping', 'mixed');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'open', 'drawn', 'revealed', 'closed');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('invited', 'joined', 'declined');

-- CreateEnum
CREATE TYPE "ExclusionType" AS ENUM ('same_department', 'pair', 'previous_year');

-- CreateEnum
CREATE TYPE "SenderRole" AS ENUM ('giver', 'receiver');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('pending', 'delivered');

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uid_nummer" TEXT,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "slack_webhook_url" TEXT,
    "teams_webhook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_domain" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verify_token" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "entra_tenant_id" TEXT,

    CONSTRAINT "sso_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "department" TEXT,
    "location" TEXT,
    "role" "Role" NOT NULL DEFAULT 'member',
    "managed_locations" TEXT[],
    "locale" TEXT NOT NULL DEFAULT 'de',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_token" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "admin_invite" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "locations" TEXT[],
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "admin_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "budget_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "signup_deadline" TIMESTAMP(3) NOT NULL,
    "draw_at" TIMESTAMP(3) NOT NULL,
    "handover_at" TIMESTAMP(3),
    "reveal_at" TIMESTAMP(3) NOT NULL,
    "mode" "CampaignMode" NOT NULL DEFAULT 'onsite',
    "place" TEXT,
    "scope_location" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "delete_after_days" INTEGER NOT NULL DEFAULT 30,
    "invite_token" TEXT NOT NULL,
    "exclude_same_department" BOOLEAN NOT NULL DEFAULT false,
    "exclude_previous_year" BOOLEAN NOT NULL DEFAULT false,
    "allow_late_join" BOOLEAN NOT NULL DEFAULT true,
    "tier" "Plan" NOT NULL DEFAULT 'free',
    "stripe_session_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "drawn_at" TIMESTAMP(3),
    "revealed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "purge_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "guess_game_enabled" BOOLEAN NOT NULL DEFAULT false,
    "vouchers_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'invited',
    "shipping_address_enc" TEXT,
    "late_joiner" BOOLEAN NOT NULL DEFAULT false,
    "feedback_given" BOOLEAN NOT NULL DEFAULT false,
    "invite_sent_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "links" TEXT[],
    "tags" TEXT[],
    "no_gos" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exclusion_rule" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "type" "ExclusionType" NOT NULL,
    "participant_a" TEXT,
    "participant_b" TEXT,

    CONSTRAINT "exclusion_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "giver_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "revealed_at" TIMESTAMP(3),

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "sender_role" "SenderRole" NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "previous_pair" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "giver_hash" TEXT NOT NULL,
    "receiver_hash" TEXT NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "previous_pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_log" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guess_vote" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "guesser_id" TEXT NOT NULL,
    "guessed_giver_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guess_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "min_cents" INTEGER NOT NULL,
    "max_cents" INTEGER NOT NULL,
    "url" TEXT,
    "affiliate" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gift_idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "code_enc" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_domain_domain_key" ON "sso_domain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_organization_id_idx" ON "user"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_provider_account_id_key" ON "account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_token_key" ON "verification_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_identifier_token_key" ON "verification_token"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "admin_invite_token_key" ON "admin_invite"("token");

-- CreateIndex
CREATE INDEX "admin_invite_organization_id_idx" ON "admin_invite"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_invite_token_key" ON "campaign"("invite_token");

-- CreateIndex
CREATE INDEX "campaign_organization_id_idx" ON "campaign"("organization_id");

-- CreateIndex
CREATE INDEX "campaign_status_draw_at_idx" ON "campaign"("status", "draw_at");

-- CreateIndex
CREATE INDEX "participant_campaign_id_idx" ON "participant"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_campaign_id_user_id_key" ON "participant"("campaign_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_participant_id_key" ON "wishlist"("participant_id");

-- CreateIndex
CREATE INDEX "exclusion_rule_campaign_id_idx" ON "exclusion_rule"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_campaign_id_giver_id_key" ON "assignment"("campaign_id", "giver_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_campaign_id_receiver_id_key" ON "assignment"("campaign_id", "receiver_id");

-- CreateIndex
CREATE INDEX "message_assignment_id_created_at_idx" ON "message"("assignment_id", "created_at");

-- CreateIndex
CREATE INDEX "previous_pair_organization_id_idx" ON "previous_pair"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_log_campaign_id_kind_key" ON "reminder_log"("campaign_id", "kind");

-- CreateIndex
CREATE INDEX "feedback_campaign_id_idx" ON "feedback"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "guess_vote_campaign_id_guesser_id_key" ON "guess_vote"("campaign_id", "guesser_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_assignment_id_key" ON "voucher"("assignment_id");

-- AddForeignKey
ALTER TABLE "sso_domain" ADD CONSTRAINT "sso_domain_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invite" ADD CONSTRAINT "admin_invite_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant" ADD CONSTRAINT "participant_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusion_rule" ADD CONSTRAINT "exclusion_rule_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_giver_id_fkey" FOREIGN KEY ("giver_id") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "previous_pair" ADD CONSTRAINT "previous_pair_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guess_vote" ADD CONSTRAINT "guess_vote_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guess_vote" ADD CONSTRAINT "guess_vote_guesser_id_fkey" FOREIGN KEY ("guesser_id") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher" ADD CONSTRAINT "voucher_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
