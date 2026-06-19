// Unit tests for ServiceFactory — every concrete service and mock service module
// is mocked with a no-op stub class, so the factory is tested in isolation from
// the real service constructors (which would otherwise need DAOs registered).
// The tests verify the useMocks branch selects the right implementation, that
// each getter returns the constructed instance, and that instances are cached.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceFactory } from "@/services/factory/ServiceFactory";
import { BadgeService } from "@/services/BadgeService";
import { AnalyticsService } from "@/services/AnalyticsService";
import { ChatService } from "@/services/ChatService";
import { CloudFunctionsService } from "@/services/CloudFunctionsService";
import { GameDataService } from "@/services/GameDataService";
import { GridService } from "@/services/GridService";
import { RoadmapService } from "@/services/RoadmapService";
import { StorageService } from "@/services/StorageService";
import { StripeService } from "@/services/StripeService";
import { UpvoteService } from "@/services/UpvoteService";
import { UserService } from "@/services/UserService";
import { MockBadgeService } from "@/services/mocks/MockBadgeService";
import { MockAnalyticsService } from "@/services/mocks/MockAnalyticsService";
import { MockChatService } from "@/services/mocks/MockChatService";
import { MockCloudFunctionsService } from "@/services/mocks/MockCloudFunctionsService";
import { MockGameDataService } from "@/services/mocks/MockGameDataService";
import { MockGridService } from "@/services/mocks/MockGridService";
import { MockRoadmapService } from "@/services/mocks/MockRoadmapService";
import { MockStorageService } from "@/services/mocks/MockStorageService";
import { MockStripeService } from "@/services/mocks/MockStripeService";
import { MockUpvoteService } from "@/services/mocks/MockUpvoteService";
import { MockUserService } from "@/services/mocks/MockUserService";

// Replace each service/mock module with a trivial stub class so constructing the
// factory never touches DAOs, auth, or any other real dependency.
function stub() {
  return class {};
}
vi.mock("@/services/BadgeService", () => ({ BadgeService: stub() }));
vi.mock("@/services/AnalyticsService", () => ({ AnalyticsService: stub() }));
vi.mock("@/services/ChatService", () => ({ ChatService: stub() }));
vi.mock("@/services/CloudFunctionsService", () => ({
  CloudFunctionsService: stub(),
}));
vi.mock("@/services/GameDataService", () => ({ GameDataService: stub() }));
vi.mock("@/services/GridService", () => ({ GridService: stub() }));
vi.mock("@/services/RoadmapService", () => ({ RoadmapService: stub() }));
vi.mock("@/services/StorageService", () => ({ StorageService: stub() }));
vi.mock("@/services/StripeService", () => ({ StripeService: stub() }));
vi.mock("@/services/UpvoteService", () => ({ UpvoteService: stub() }));
vi.mock("@/services/UserService", () => ({ UserService: stub() }));
vi.mock("@/services/mocks/MockBadgeService", () => ({ MockBadgeService: stub() }));
vi.mock("@/services/mocks/MockAnalyticsService", () => ({
  MockAnalyticsService: stub(),
}));
vi.mock("@/services/mocks/MockChatService", () => ({ MockChatService: stub() }));
vi.mock("@/services/mocks/MockCloudFunctionsService", () => ({
  MockCloudFunctionsService: stub(),
}));
vi.mock("@/services/mocks/MockGameDataService", () => ({
  MockGameDataService: stub(),
}));
vi.mock("@/services/mocks/MockGridService", () => ({ MockGridService: stub() }));
vi.mock("@/services/mocks/MockRoadmapService", () => ({
  MockRoadmapService: stub(),
}));
vi.mock("@/services/mocks/MockStorageService", () => ({
  MockStorageService: stub(),
}));
vi.mock("@/services/mocks/MockStripeService", () => ({
  MockStripeService: stub(),
}));
vi.mock("@/services/mocks/MockUpvoteService", () => ({
  MockUpvoteService: stub(),
}));
vi.mock("@/services/mocks/MockUserService", () => ({ MockUserService: stub() }));

// (getter, real ctor, mock ctor) tuples cover all 11 services.
const services = [
  ["getBadgeService", BadgeService, MockBadgeService],
  ["getAnalyticsService", AnalyticsService, MockAnalyticsService],
  ["getChatService", ChatService, MockChatService],
  ["getCloudFunctionsService", CloudFunctionsService, MockCloudFunctionsService],
  ["getGameDataService", GameDataService, MockGameDataService],
  ["getGridService", GridService, MockGridService],
  ["getRoadmapService", RoadmapService, MockRoadmapService],
  ["getStorageService", StorageService, MockStorageService],
  ["getStripeService", StripeService, MockStripeService],
  ["getUpvoteService", UpvoteService, MockUpvoteService],
  ["getUserService", UserService, MockUserService],
] as const;

let realFactory: ServiceFactory;
let mockFactory: ServiceFactory;

beforeEach(() => {
  realFactory = new ServiceFactory();
  mockFactory = new ServiceFactory(true);
});

describe("ServiceFactory (default / useMocks=false)", () => {
  it.each(services)(
    "%s returns the real implementation",
    (getter, RealCtor) => {
      const instance = (realFactory[getter] as () => unknown)();
      expect(instance).toBeInstanceOf(RealCtor);
    },
  );

  it.each(services)("%s returns a cached instance", (getter) => {
    const fn = realFactory[getter] as () => unknown;
    expect(fn.call(realFactory)).toBe(fn.call(realFactory));
  });
});

describe("ServiceFactory (useMocks=true)", () => {
  it.each(services)(
    "%s returns the mock implementation",
    (getter, _RealCtor, MockCtor) => {
      const instance = (mockFactory[getter] as () => unknown)();
      expect(instance).toBeInstanceOf(MockCtor);
    },
  );

  it.each(services)("%s returns a cached instance", (getter) => {
    const fn = mockFactory[getter] as () => unknown;
    expect(fn.call(mockFactory)).toBe(fn.call(mockFactory));
  });
});
