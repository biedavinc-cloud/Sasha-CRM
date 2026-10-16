// GENERATED from base44/entities/*.jsonc by scripts/gen-policies.mjs — now the source of truth.
export const ENTITIES = {
  "AccessRequest": {
    "defaults": {
      "requested_role": "user",
      "status": "pending"
    },
    "enums": {
      "requested_role": [
        "admin",
        "user"
      ],
      "status": [
        "pending",
        "approved",
        "rejected"
      ]
    },
    "required": [
      "user_id",
      "user_email"
    ],
    "rls": {
      "read": {
        "$or": [
          {
            "data.user_id": "{{user.id}}"
          },
          {
            "user_condition": {
              "role": "admin"
            }
          }
        ]
      },
      "create": {},
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Appointment": {
    "defaults": {
      "status": "booked"
    },
    "enums": {
      "status": [
        "booked",
        "confirmed",
        "completed",
        "cancelled",
        "no_show"
      ]
    },
    "required": [
      "client_name",
      "date",
      "service_name"
    ],
    "rls": {
      "read": {
        "user_condition": {
          "role": "admin"
        }
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "AuditLog": {
    "defaults": {},
    "enums": {},
    "required": [
      "action",
      "entity"
    ],
    "rls": {
      "read": {
        "user_condition": {
          "role": "admin"
        }
      },
      "create": {},
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Client": {
    "defaults": {
      "source": "walk_in",
      "lead_status": "new",
      "customer_status": "lead"
    },
    "enums": {
      "source": [
        "partner_referral",
        "walk_in",
        "social_media",
        "website",
        "other"
      ],
      "lead_status": [
        "new",
        "contacted",
        "consultation_booked",
        "appointment_booked",
        "completed",
        "lost",
        "cancelled"
      ],
      "customer_status": [
        "lead",
        "active",
        "inactive",
        "vip"
      ]
    },
    "required": [
      "full_name",
      "phone"
    ],
    "rls": {
      "read": {
        "user_condition": {
          "role": "admin"
        }
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "ClinicSetting": {
    "defaults": {
      "setting_key": "default",
      "clinic_name": "Sasha Aesthetic Clinic",
      "referral_base_url": "",
      "default_attribution_window_days": 30,
      "default_commission_percentage": 10,
      "default_commission_basis": "gross",
      "notify_email_on_commission_approval": true,
      "notify_email_on_payout": true,
      "notify_whatsapp_on_payout": false
    },
    "enums": {
      "default_commission_basis": [
        "gross",
        "profit"
      ]
    },
    "required": [
      "setting_key"
    ],
    "rls": {
      "read": {
        "user_condition": {
          "role": "admin"
        }
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Commission": {
    "defaults": {
      "basis": "gross",
      "status": "pending"
    },
    "enums": {
      "basis": [
        "gross",
        "profit"
      ],
      "status": [
        "pending",
        "approved",
        "payable",
        "paid",
        "rejected",
        "held",
        "disputed"
      ]
    },
    "required": [
      "referral_id",
      "partner_id",
      "partner_user_id",
      "commission_amount"
    ],
    "rls": {
      "read": {
        "$or": [
          {
            "data.partner_user_id": "{{user.id}}"
          },
          {
            "user_condition": {
              "role": "admin"
            }
          }
        ]
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Lead": {
    "defaults": {
      "source": "partner_referral",
      "status": "new"
    },
    "enums": {
      "source": [
        "partner_referral",
        "walk_in",
        "social_media",
        "website",
        "other"
      ],
      "status": [
        "new",
        "contacted",
        "consultation_booked",
        "appointment_booked",
        "completed",
        "lost",
        "cancelled"
      ]
    },
    "required": [
      "full_name",
      "phone"
    ],
    "rls": {
      "read": {
        "user_condition": {
          "role": "admin"
        }
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Partner": {
    "defaults": {
      "partner_type": "hair_salon",
      "status": "pending",
      "commission_percentage": 10,
      "commission_basis": "gross",
      "attribution_window_days": 30
    },
    "enums": {
      "partner_type": [
        "hair_salon",
        "beauty_salon",
        "spa",
        "gym",
        "influencer",
        "corporate",
        "hotel",
        "other"
      ],
      "status": [
        "active",
        "suspended",
        "inactive",
        "pending"
      ],
      "commission_basis": [
        "gross",
        "profit"
      ]
    },
    "required": [
      "business_name",
      "referral_code",
      "user_id"
    ],
    "rls": {
      "read": {
        "$or": [
          {
            "data.user_id": "{{user.id}}"
          },
          {
            "user_condition": {
              "role": "admin"
            }
          }
        ]
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Payout": {
    "defaults": {
      "status": "pending"
    },
    "enums": {
      "status": [
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled"
      ]
    },
    "required": [
      "partner_id",
      "partner_user_id",
      "amount"
    ],
    "rls": {
      "read": {
        "$or": [
          {
            "data.partner_user_id": "{{user.id}}"
          },
          {
            "user_condition": {
              "role": "admin"
            }
          }
        ]
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Referral": {
    "defaults": {
      "status": "lead_created",
      "fraud_flag": false,
      "fraud_score": 0
    },
    "enums": {
      "status": [
        "clicked",
        "lead_created",
        "contacted",
        "appointment_booked",
        "appointment_completed",
        "treatment_completed",
        "satisfaction_confirmed",
        "commission_pending",
        "commission_approved",
        "commission_payable",
        "paid",
        "cancelled",
        "no_show",
        "rejected",
        "refunded",
        "disputed"
      ]
    },
    "required": [
      "partner_id",
      "partner_user_id",
      "client_name"
    ],
    "rls": {
      "read": {
        "$or": [
          {
            "data.partner_user_id": "{{user.id}}"
          },
          {
            "user_condition": {
              "role": "admin"
            }
          }
        ]
      },
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "ReferralClick": {
    "defaults": {
      "converted": false
    },
    "enums": {},
    "required": [
      "partner_id",
      "referral_code"
    ],
    "rls": {
      "read": {
        "user_condition": {
          "role": "admin"
        }
      },
      "create": {},
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  },
  "Service": {
    "defaults": {
      "active": true,
      "commission_eligible": true
    },
    "enums": {
      "category": [
        "Hair Transplant & Restoration",
        "IV Therapy",
        "Facials & Skin Care",
        "Slimming & Body Sculpting",
        "Dental & Cosmetics",
        "Laser Hair Removal",
        "Fillers & Dermatology",
        "Permanent Makeup",
        "Other"
      ]
    },
    "required": [
      "name",
      "category"
    ],
    "rls": {
      "read": {},
      "create": {
        "user_condition": {
          "role": "admin"
        }
      },
      "update": {
        "user_condition": {
          "role": "admin"
        }
      },
      "delete": {
        "user_condition": {
          "role": "admin"
        }
      }
    }
  }
};
