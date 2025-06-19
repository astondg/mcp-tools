# POST /projects/0.1/bids/

## Headers
'freelancer-oauth-v1: <oauth_access_token>'
'Content-Type: application/json'

## Schema
```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "project_id": {
      "type": "number",
      "description": "ID of the project to bid on."
    },
    "bidder_id": {
      "type": "number",
      "description": "ID of the bidder."
    },
    "amount": {
      "type": "number",
      "description": "Amount of money to bid (currency based on project currency). Decimal"
    },
    "period": {
      "type": "number",
      "description": "Period of time to complete the project (days)."
    },
    "milestone_percentage": {
      "type": "number",
      "description": "Percentage of milestone to be completed (0 - 100). Decimal"
    },
    "description": {
      "type": "string",
      "description": "Proposal description"
    },
    "profile_id": {
      "type": "number",
      "description": "Profile ID used to bid."
    }
  },
  "required": [
    "project_id",
    "bidder_id",
    "amount",
    "period",
    "milestone_percentage"
  ]
}
```

## Response Example
```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "success"
      ]
    },
    "request_id": {
      "type": "string"
    },
    "result": {
      "type": "object",
      "properties": {
        "id": {
          "type": "number"
        },
        "bidder_id": {
          "type": "number"
        },
        "project_id": {
          "type": "number"
        },
        "retracted": {
          "type": "boolean"
        },
        "amount": {
          "type": "number",
          "description": "Decimal"
        },
        "period": {
          "type": "number"
        },
        "description": {
          "type": "string"
        },
        "project_owner_id": {
          "type": "number"
        },
        "time_submitted": {
          "type": "number"
        },
        "highlighted": {
          "type": "boolean"
        },
        "sponsored": {
          "type": "number",
          "description": "Decimal"
        },
        "milestone_percentage": {
          "type": [
            "number",
            "null"
          ],
          "description": "Decimal"
        },
        "award_status": {
          "type": [
            "string",
            "null"
          ],
          "enum": [
            "awarded",
            "rejected",
            "revoked",
            "pending",
            "canceled",
            null
          ]
        },
        "paid_status": {
          "type": [
            "string",
            "null"
          ],
          "enum": [
            "unpaid",
            "partly_paid",
            "fully_paid",
            null
          ]
        },
        "complete_status": {
          "type": [
            "string",
            "null"
          ],
          "enum": [
            "pending",
            "incomplete",
            "complete",
            null
          ]
        },
        "reputation": {
          "type": "object",
          "properties": {
            "entire_history": {
              "type": "object",
              "properties": {
                "overall": {
                  "type": "number",
                  "description": "Decimal"
                },
                "on_budget": {
                  "type": "number",
                  "description": "Decimal"
                },
                "on_time": {
                  "type": "number",
                  "description": "Decimal"
                },
                "positive": {
                  "type": "number",
                  "description": "Decimal"
                },
                "category_ratings": {
                  "type": "object",
                  "properties": {
                    "communication": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "expertise": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "hire_again": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "quality": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "professionalism": {
                      "type": "number",
                      "description": "Decimal"
                    }
                  }
                },
                "all": {
                  "type": "number"
                },
                "reviews": {
                  "type": "number"
                },
                "incomplete_reviews": {
                  "type": "number"
                },
                "complete": {
                  "type": "number"
                },
                "incomplete": {
                  "type": "number"
                },
                "earnings": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "description": "permission: `user:financial`. Decimal"
                },
                "completion_rate": {
                  "type": "number",
                  "description": "Decimal"
                },
                "rehire_rate": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "description": "Decimal"
                }
              },
              "required": [
                "overall",
                "on_budget",
                "on_time",
                "positive",
                "all",
                "reviews",
                "incomplete_reviews",
                "complete",
                "incomplete",
                "earnings",
                "completion_rate"
              ]
            },
            "last3months": {
              "type": "object",
              "properties": {
                "overall": {
                  "type": "number",
                  "description": "Decimal"
                },
                "on_budget": {
                  "type": "number",
                  "description": "Decimal"
                },
                "on_time": {
                  "type": "number",
                  "description": "Decimal"
                },
                "positive": {
                  "type": "number",
                  "description": "Decimal"
                },
                "category_ratings": {
                  "type": "object",
                  "properties": {
                    "communication": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "expertise": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "hire_again": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "quality": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "professionalism": {
                      "type": "number",
                      "description": "Decimal"
                    }
                  }
                },
                "all": {
                  "type": "number"
                },
                "reviews": {
                  "type": "number"
                },
                "incomplete_reviews": {
                  "type": "number"
                },
                "complete": {
                  "type": "number"
                },
                "incomplete": {
                  "type": "number"
                },
                "earnings": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "description": "permission: `user:financial`. Decimal"
                },
                "completion_rate": {
                  "type": "number",
                  "description": "Decimal"
                },
                "rehire_rate": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "description": "Decimal"
                }
              },
              "required": [
                "overall",
                "on_budget",
                "on_time",
                "positive",
                "all",
                "reviews",
                "incomplete_reviews",
                "complete",
                "incomplete",
                "earnings",
                "completion_rate"
              ]
            },
            "last12months": {
              "type": "object",
              "properties": {
                "overall": {
                  "type": "number",
                  "description": "Decimal"
                },
                "on_budget": {
                  "type": "number",
                  "description": "Decimal"
                },
                "on_time": {
                  "type": "number",
                  "description": "Decimal"
                },
                "positive": {
                  "type": "number",
                  "description": "Decimal"
                },
                "category_ratings": {
                  "type": "object",
                  "properties": {
                    "communication": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "expertise": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "hire_again": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "quality": {
                      "type": "number",
                      "description": "Decimal"
                    },
                    "professionalism": {
                      "type": "number",
                      "description": "Decimal"
                    }
                  }
                },
                "all": {
                  "type": "number"
                },
                "reviews": {
                  "type": "number"
                },
                "incomplete_reviews": {
                  "type": "number"
                },
                "complete": {
                  "type": "number"
                },
                "incomplete": {
                  "type": "number"
                },
                "earnings": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "description": "permission: `user:financial`. Decimal"
                },
                "completion_rate": {
                  "type": "number",
                  "description": "Decimal"
                },
                "rehire_rate": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "description": "Decimal"
                }
              },
              "required": [
                "overall",
                "on_budget",
                "on_time",
                "positive",
                "all",
                "reviews",
                "incomplete_reviews",
                "complete",
                "incomplete",
                "earnings",
                "completion_rate"
              ]
            },
            "user_id": {
              "type": "number"
            },
            "role": {
              "type": "string",
              "enum": [
                "freelancer",
                "employer"
              ]
            },
            "earnings_score": {
              "type": "number",
              "description": "Decimal"
            },
            "job_history": {
              "type": [
                "object",
                "null"
              ],
              "properties": {
                "count_other": {
                  "type": "number"
                },
                "job_counts": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "count": {
                        "type": "number"
                      },
                      "job": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "number"
                          },
                          "name": {
                            "type": "string"
                          },
                          "category": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "number"
                              },
                              "name": {
                                "type": "string"
                              }
                            },
                            "required": [
                              "id"
                            ]
                          },
                          "active_project_count": {
                            "type": "number"
                          },
                          "seo_url": {
                            "type": "string"
                          },
                          "seo_info": {
                            "type": "object",
                            "properties": {
                              "seo_text": {
                                "type": "string"
                              },
                              "seo_text_alt": {
                                "type": "string"
                              },
                              "seo_worker": {
                                "type": "string"
                              },
                              "seo_worker_alt": {
                                "type": "string"
                              },
                              "seo_worker_plural": {
                                "type": "string"
                              },
                              "seo_worker_plural_alt": {
                                "type": "string"
                              },
                              "phrase_worker": {
                                "type": "string"
                              },
                              "context_phrase_worker": {
                                "type": "string"
                              },
                              "plural_phrase_worker": {
                                "type": "string"
                              },
                              "country_person": {
                                "type": "string"
                              },
                              "country_demonym": {
                                "type": "string"
                              }
                            }
                          },
                          "local": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "id",
                          "active_project_count"
                        ]
                      }
                    },
                    "required": [
                      "count",
                      "job"
                    ]
                  }
                }
              },
              "required": [
                "count_other",
                "job_counts"
              ]
            },
            "project_stats": {
              "type": [
                "object",
                "null"
              ],
              "properties": {
                "open": {
                  "type": "number"
                }
              }
            }
          },
          "required": [
            "entire_history",
            "last3months",
            "last12months",
            "earnings_score"
          ]
        },
        "time_awarded": {
          "type": [
            "number",
            "null"
          ]
        },
        "frontend_bid_status": {
          "type": "string",
          "enum": [
            "active",
            "in_progress",
            "complete"
          ]
        },
        "shortlisted": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "is_location_tracked": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "score": {
          "type": [
            "number",
            "null"
          ],
          "description": "Decimal"
        },
        "time_accepted": {
          "type": [
            "number",
            "null"
          ]
        },
        "hidden": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "paid_amount": {
          "type": [
            "number",
            "null"
          ],
          "description": "Decimal"
        },
        "": {
          "type": [
            "array",
            "null"
          ]
        }
      },
      "required": [
        "id",
        "bidder_id",
        "project_id",
        "retracted",
        "amount",
        "period",
        "description",
        "project_owner_id"
      ]
    },
    "users": {
      "type": [
        "array",
        "null"
      ]
    },
    "projects": {
      "type": [
        "array",
        "null"
      ]
    }
  },
  "required": [
    "status",
    "result"
  ]
}
```