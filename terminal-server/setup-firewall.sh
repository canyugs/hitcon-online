#!/bin/bash
BRIDGE_IF="isolated_if"  # run `docker network create` to create a new bridge
ALLOW_IP="104.199.190.125"

doc() {
    echo Usage: "$0" 'set|reset'
    echo This script bans all traffics on one interface except one host.
}

set() {
    iptables -I DOCKER-USER -i "${BRIDGE_IF}" -j DROP
    iptables -I DOCKER-USER -o "${BRIDGE_IF}" -j DROP
    # iptables -I DOCKER-USER -j LOG --log-level error
    iptables -I DOCKER-USER -i "${BRIDGE_IF}" -d "${ALLOW_IP}" -j RETURN
    iptables -I DOCKER-USER -o "${BRIDGE_IF}" -s "${ALLOW_IP}" -j RETURN
    iptables -I DOCKER-USER -p udp -m udp --dport 53 -j RETURN
    iptables -I DOCKER-USER -p udp -m udp --sport 53 -j RETURN
}

reset() {
    iptables -D DOCKER-USER -i "${BRIDGE_IF}" -j DROP
    iptables -D DOCKER-USER -o "${BRIDGE_IF}" -j DROP
    # iptables -D DOCKER-USER -j LOG --log-level error
    iptables -D DOCKER-USER -i "${BRIDGE_IF}" -d "${ALLOW_IP}" -j RETURN
    iptables -D DOCKER-USER -o "${BRIDGE_IF}" -s "${ALLOW_IP}" -j RETURN
    iptables -D DOCKER-USER -p udp -m udp --dport 53 -j RETURN
    iptables -D DOCKER-USER -p udp -m udp --sport 53 -j RETURN
}

if [ "$EUID" -ne 0 ]; then
    echo 'Should be run as root'
elif [ "$1"  == 'set' ]; then
    set
elif [ "$1" == 'reset' ]; then
    reset
else
    doc
fi

