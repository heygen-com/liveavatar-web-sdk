import { describe, it, expect, vi } from "vitest";
import {
  AbstractConnectionQualityIndicator,
  QualityIndicatorComposite,
} from "./base";
import { ConnectionQuality } from "./types";

class ChildIndicator extends AbstractConnectionQualityIndicator<any> {
  private _quality: ConnectionQuality = ConnectionQuality.UNKNOWN;

  calculateConnectionQuality(): ConnectionQuality {
    return this._quality;
  }

  protected _start(): void {}

  protected _stop(): void {}

  public _triggerConnectionQualityChanged(quality: ConnectionQuality): void {
    this._quality = quality;
    this.handleStatsChanged();
  }
}

const setupIndicators = (
  onConnectionQualityChanged: (quality: ConnectionQuality) => void,
) => {
  class ChildIndicator1 extends ChildIndicator {
    static instance: ChildIndicator1 | null = null;

    constructor(
      onConnectionQualityChanged: (quality: ConnectionQuality) => void,
    ) {
      if (ChildIndicator1.instance) {
        return ChildIndicator1.instance;
      }
      super(onConnectionQualityChanged);
      ChildIndicator1.instance = this;
    }
  }

  class ChildIndicator2 extends ChildIndicator {
    static instance: ChildIndicator2 | null = null;

    constructor(
      onConnectionQualityChanged: (quality: ConnectionQuality) => void,
    ) {
      if (ChildIndicator2.instance) {
        return ChildIndicator2.instance;
      }
      super(onConnectionQualityChanged);
      ChildIndicator2.instance = this;
    }
  }

  const IndicatorCompositeClass = QualityIndicatorComposite(
    {
      TrackerClass: ChildIndicator1,
      getParams: () => ({}),
    },
    {
      TrackerClass: ChildIndicator2,
      getParams: () => ({}),
    },
  );

  const indicator = new IndicatorCompositeClass(onConnectionQualityChanged);
  return { indicator, ChildIndicator1, ChildIndicator2 };
};

describe("QualityIndicatorComposite", () => {
  it("resolves to BAD when any child indicator resolves to BAD", () => {
    const onConnectionQualityChanged = vi.fn();
    const { indicator, ChildIndicator1, ChildIndicator2 } = setupIndicators(
      onConnectionQualityChanged,
    );
    indicator.start({});
    ChildIndicator1.instance?._triggerConnectionQualityChanged(
      ConnectionQuality.BAD,
    );
    ChildIndicator2.instance?._triggerConnectionQualityChanged(
      ConnectionQuality.GOOD,
    );
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.BAD,
    );
  });

  it("resolves to UNKNOWN when all child indicators resolve to UNKNOWN", () => {
    const onConnectionQualityChanged = vi.fn();
    const { indicator, ChildIndicator1 } = setupIndicators(
      onConnectionQualityChanged,
    );
    indicator.start({});
    ChildIndicator1.instance?._triggerConnectionQualityChanged(
      ConnectionQuality.BAD,
    );
    ChildIndicator1.instance?._triggerConnectionQualityChanged(
      ConnectionQuality.UNKNOWN,
    );
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.UNKNOWN,
    );
  });

  it("resolves to GOOD when at least one child indicator resolves to GOOD and no child indicator resolves to BAD", () => {
    const onConnectionQualityChanged = vi.fn();
    const { indicator, ChildIndicator1 } = setupIndicators(
      onConnectionQualityChanged,
    );
    indicator.start({});
    ChildIndicator1.instance?._triggerConnectionQualityChanged(
      ConnectionQuality.GOOD,
    );
    expect(onConnectionQualityChanged).toHaveBeenCalledWith(
      ConnectionQuality.GOOD,
    );
  });
});
