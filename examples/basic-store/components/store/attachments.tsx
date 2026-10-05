import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

export function DocumentTypeLabel() {
  return (
    <Vtex.IfCond
      fallback={
        <Section>
          <Vtex.IfCond
            fallback={
              <Section>
                <Vtex.IfCond
                  fallback={
                    <Text className="m-0 text-sm text-zinc-700">
                      <Vtex.Value path="content.documentType" />
                    </Text>
                  }
                  operator="=="
                  path="content.documentType"
                  value="DOC-P"
                >
                  <Text className="m-0 text-sm text-zinc-700">
                    <Trans id="store.doc.passport" />
                  </Text>
                </Vtex.IfCond>
              </Section>
            }
            operator="=="
            path="content.documentType"
            value="DOC-E"
          >
            <Text className="m-0 text-sm text-zinc-700">
              <Trans id="store.doc.foreign" />
            </Text>
          </Vtex.IfCond>
        </Section>
      }
      operator="=="
      path="content.documentType"
      value="DOC-C"
    >
      <Text className="m-0 text-sm text-zinc-700">
        <Trans id="store.doc.national" />
      </Text>
    </Vtex.IfCond>
  )
}

export function ParticipantRows() {
  return (
    <Vtex.Each path="attachments">
      <Section>
        <Vtex.IfCond operator="===" path="name" value="Recipient">
          <Section>
            <Vtex.IfCond operator="!=" path="content.dateRange" value="">
              <Text className="m-0 mt-2 text-sm text-zinc-600">
                <Trans id="store.item.dates" /> <Vtex.Value path="content.dateRange" />
              </Text>
            </Vtex.IfCond>
            <Text className="m-0 mt-2 text-sm text-zinc-600">
              <Trans id="store.item.participant" /> <Vtex.Value path="content.firstName" />{' '}
              <Vtex.Value path="content.lastName" />
            </Text>
            <Section className="mt-1">
              <Text className="m-0 text-sm text-zinc-600">
                <Trans id="store.item.document" />
              </Text>
              <DocumentTypeLabel />
              <Text className="m-0 text-sm text-zinc-600">
                <Vtex.Value path="content.documentNumber" />
              </Text>
            </Section>
          </Section>
        </Vtex.IfCond>
      </Section>
    </Vtex.Each>
  )
}

export function DiscountRows() {
  return (
    <Vtex.Each path="attachments">
      <Section>
        <Vtex.IfCond operator="===" path="name" value="ItemDiscounts">
          <Section>
            <Section className="mt-2">
              <Text className="m-0 text-sm text-zinc-600">
                <Trans id="store.item.tariff" />
              </Text>
              <Vtex.HasSubStr
                fallback={
                  <Section>
                    <Vtex.HasSubStr
                      fallback={
                        <Section>
                          <Vtex.HasSubStr
                            fallback={
                              <Text className="m-0 text-sm text-zinc-600">
                                <Trans id="store.tariff.d" />
                              </Text>
                            }
                            path="content.priceTable"
                            value="tariff-c"
                          >
                            <Text className="m-0 text-sm text-zinc-600">
                              <Trans id="store.tariff.c" />
                            </Text>
                          </Vtex.HasSubStr>
                        </Section>
                      }
                      path="content.priceTable"
                      value="tariff-b"
                    >
                      <Text className="m-0 text-sm text-zinc-600">
                        <Trans id="store.tariff.b" />
                      </Text>
                    </Vtex.HasSubStr>
                  </Section>
                }
                path="content.priceTable"
                value="tariff-a"
              >
                <Text className="m-0 text-sm text-zinc-600">
                  <Trans id="store.tariff.a" />
                </Text>
              </Vtex.HasSubStr>
            </Section>
            <Vtex.IfCond operator="!=" path="content.businessAgreement" value="">
              <Text className="m-0 mt-1 text-sm text-zinc-600">
                <Trans id="store.item.agreement" /> <Vtex.Value path="content.businessAgreement" />
              </Text>
            </Vtex.IfCond>
          </Section>
        </Vtex.IfCond>
      </Section>
    </Vtex.Each>
  )
}
